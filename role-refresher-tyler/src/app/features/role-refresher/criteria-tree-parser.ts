import {
  CriteriaTreeNode,
  LeafCondition,
  LeafOperation,
  RawCriteriaNode,
} from './role-membership.types';

const BRANCH_OPS = new Set(['AND', 'OR']);
const LEAF_OPS = new Set(['EQUALS', 'NOT_EQUALS', 'CONTAINS', 'STARTS_WITH', 'ENDS_WITH']);

/**
 * Recursively parses a raw ISC criteria node into:
 *  - a normalized tree (`CriteriaTreeNode`) that mirrors AND/OR/leaf structure
 *  - a flat list of leaf conditions (post-order collection) for easy iteration
 *
 * Validates the two structural invariants the API documents:
 *  - leaf nodes require `key` + `stringValue`, no `children`
 *  - branch nodes require `children`, no `stringValue`
 * Violations are collected as warnings rather than thrown, so callers can
 * decide how strict to be against real-world (possibly legacy) role data.
 */
export function parseCriteriaTree(
  node: RawCriteriaNode,
  warnings: string[],
  path = '0',
): { tree: CriteriaTreeNode; leaves: LeafCondition[] } {
  const leaves: LeafCondition[] = [];

  function walk(n: RawCriteriaNode, p: string): CriteriaTreeNode {
    if (BRANCH_OPS.has(n.operation)) {
      if (!n.children || n.children.length === 0) {
        warnings.push(`Branch node at path ${p} (${n.operation}) has no children.`);
      }
      if (n.stringValue != null || (n.values != null && n.values.length > 0)) {
        warnings.push(`Branch node at path ${p} (${n.operation}) unexpectedly has a value; ignoring it.`);
      }
      const children = (n.children ?? []).map((child, i) => walk(child, `${p}.${i}`));
      return {
        kind: 'branch',
        operation: n.operation as 'AND' | 'OR',
        path: p,
        children,
      };
    }

    if (LEAF_OPS.has(n.operation)) {
      if (n.children && n.children.length > 0) {
        warnings.push(`Leaf node at path ${p} (${n.operation}) unexpectedly has children; ignoring them.`);
      }
      if (!n.key) {
        warnings.push(`Leaf node at path ${p} (${n.operation}) is missing a key; skipping.`);
        return { kind: 'leaf', path: p, condition: emptyCondition(p, n.operation as LeafOperation) };
      }
      // Live tenant responses have been observed to return `values: [...]`
      // instead of the documented `stringValue` for leaf conditions. Prefer
      // `stringValue` when present (matches the documented request/response
      // schema), falling back to the first element of `values`.
      const resolvedValue = n.stringValue ?? n.values?.[0] ?? null;
      if (resolvedValue == null) {
        warnings.push(`Leaf node at path ${p} (${n.operation}) is missing both stringValue and values.`);
      }
      if ((n.key.type === 'ACCOUNT' || n.key.type === 'ENTITLEMENT') && !n.key.sourceId) {
        warnings.push(
          `Leaf node at path ${p} has key.type=${n.key.type} but no sourceId; the generated query will be incomplete.`,
        );
      }

      const condition: LeafCondition = {
        path: p,
        keyType: n.key.type,
        property: n.key.property,
        sourceId: n.key.sourceId ?? null,
        operation: n.operation as LeafOperation,
        value: resolvedValue ?? '',
      };
      leaves.push(condition);
      return { kind: 'leaf', path: p, condition };
    }

    warnings.push(`Unknown operation "${n.operation}" at path ${p}; treating as a leaf with no-op condition.`);
    const condition = emptyCondition(p, 'EQUALS');
    leaves.push(condition);
    return { kind: 'leaf', path: p, condition };
  }

  const tree = walk(node, path);
  return { tree, leaves };
}

function emptyCondition(path: string, operation: LeafOperation): LeafCondition {
  return { path, keyType: 'IDENTITY', property: '', operation, value: '' };
}
