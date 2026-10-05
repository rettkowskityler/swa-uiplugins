import { CriteriaNode } from './role-refresher.models';

export interface EvaluationResult {
  matches: boolean;
  reasons: string[];
}

export function evaluateCriteria(
  node: CriteriaNode | null | undefined,
  identityAttributes: Record<string, any>,
  accounts: Array<{ sourceId: string; sourceName: string; attributes: Record<string, any> }>
): EvaluationResult {
  if (!node) {
    return { matches: false, reasons: ['No criteria defined'] };
  }

  const op = (node.operation || '').toUpperCase();

  if (op === 'AND') {
    const children = node.children || [];
    if (children.length === 0) {
      return { matches: true, reasons: ['Empty AND group passed'] };
    }
    const reasons: string[] = [];
    for (const child of children) {
      const childRes = evaluateCriteria(child, identityAttributes, accounts);
      reasons.push(...childRes.reasons);
      if (!childRes.matches) {
        return { matches: false, reasons };
      }
    }
    return { matches: true, reasons };
  }

  if (op === 'OR') {
    const children = node.children || [];
    if (children.length === 0) {
      return { matches: false, reasons: ['Empty OR group failed'] };
    }
    const reasons: string[] = [];
    for (const child of children) {
      const childRes = evaluateCriteria(child, identityAttributes, accounts);
      if (childRes.matches) {
        return { matches: true, reasons: childRes.reasons };
      }
      reasons.push(...childRes.reasons);
    }
    return { matches: false, reasons };
  }

  // Leaf node evaluation
  const key = node.key;
  if (!key) {
    return { matches: true, reasons: ['No key specified'] };
  }

  const rawProperty = key.property || '';
  const cleanProp = rawProperty.replace(/^attributes?\./, '');
  const expectedValue = (node.stringValue ?? '').toLowerCase();

  let actualValues: string[] = [];
  let contextLabel = '';

  if (key.type === 'IDENTITY') {
    contextLabel = `Identity [${cleanProp}]`;
    const val = identityAttributes[cleanProp] ?? identityAttributes[rawProperty];
    if (val !== undefined && val !== null) {
      if (Array.isArray(val)) {
        actualValues = val.map(v => String(v));
      } else {
        actualValues = [String(val)];
      }
    } else {
      // Check accounts attributes as fallback
      for (const acc of accounts) {
        const accVal = acc.attributes?.[cleanProp] ?? acc.attributes?.[rawProperty];
        if (accVal !== undefined && accVal !== null) {
          if (Array.isArray(accVal)) {
            actualValues.push(...accVal.map(v => String(v)));
          } else {
            actualValues.push(String(accVal));
          }
        }
      }
    }
  } else if (key.type === 'ACCOUNT') {
    const matchingAccounts = accounts.filter(a => !key.sourceId || a.sourceId === key.sourceId);
    contextLabel = `Account (${matchingAccounts[0]?.sourceName || key.sourceId || 'source'}) [${cleanProp}]`;
    for (const acc of matchingAccounts) {
      const val = acc.attributes?.[cleanProp] ?? acc.attributes?.[rawProperty];
      if (val !== undefined && val !== null) {
        if (Array.isArray(val)) {
          actualValues.push(...val.map(v => String(v)));
        } else {
          actualValues.push(String(val));
        }
      }
    }
  } else {
    contextLabel = `Entitlement [${cleanProp}]`;
  }

  const hasValue = actualValues.length > 0;
  const actualStr = actualValues.join(', ');

  let matches = false;

  switch (op) {
    case 'EQUALS':
      matches = actualValues.some(v => v.toLowerCase() === expectedValue);
      break;
    case 'NOT_EQUALS':
      matches = actualValues.length === 0 || actualValues.every(v => v.toLowerCase() !== expectedValue);
      break;
    case 'CONTAINS':
      matches = actualValues.some(v => v.toLowerCase().includes(expectedValue));
      break;
    case 'DOES_NOT_CONTAIN':
      matches = !actualValues.some(v => v.toLowerCase().includes(expectedValue));
      break;
    case 'STARTS_WITH':
      matches = actualValues.some(v => v.toLowerCase().startsWith(expectedValue));
      break;
    case 'ENDS_WITH':
      matches = actualValues.some(v => v.toLowerCase().endsWith(expectedValue));
      break;
    case 'IS_NULL':
      matches = !hasValue || actualValues.every(v => !v.trim());
      break;
    case 'IS_NOT_NULL':
      matches = hasValue && actualValues.some(v => !!v.trim());
      break;
    default:
      matches = actualValues.some(v => v.toLowerCase() === expectedValue);
  }

  const reason = matches
    ? `MATCH: ${contextLabel} ${op.toLowerCase()} "${expectedValue}" (actual: "${actualStr || 'empty'}")`
    : `MISMATCH: ${contextLabel} expected ${op.toLowerCase()} "${expectedValue}" (actual: "${actualStr || 'empty'}")`;

  return { matches, reasons: [reason] };
}

export function formatCriteriaSummary(node: CriteriaNode | null | undefined): string {
  if (!node) return 'No criteria specified (Empty)';
  const op = (node.operation || '').toUpperCase();

  if (op === 'AND' || op === 'OR') {
    const children = node.children || [];
    if (children.length === 0) return `Empty ${op}`;
    const parts = children.map(c => `(${formatCriteriaSummary(c)})`);
    return parts.join(` ${op} `);
  }

  const prop = (node.key?.property || '').replace(/^attributes?\./, '');
  const type = node.key?.type || 'IDENTITY';
  const val = node.stringValue ?? '';
  return `${type === 'ACCOUNT' ? 'Account.' : ''}${prop} ${op} "${val}"`;
}
