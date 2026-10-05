import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/role-refresher/role-refresher.component').then(
        (m) => m.RoleRefresherComponent
      ),
  },
  {
    path: 'role-refresher',
    loadComponent: () =>
      import('./features/role-refresher/role-refresher.component').then(
        (m) => m.RoleRefresherComponent
      ),
  },
  {
    path: 'workflows',
    loadComponent: () =>
      import('./features/workflows/workflows.component').then(
        (m) => m.WorkflowsComponent
      ),
  },
  {
    path: 'api-examples',
    loadComponent: () =>
      import('./features/api-examples/api-examples.component').then(
        (m) => m.ApiExamplesComponent
      ),
  },
];
