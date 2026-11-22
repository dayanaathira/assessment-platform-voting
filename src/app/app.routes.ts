import { Routes } from '@angular/router';

// Every page is lazy-loaded so the first load only ships the shell.
export const routes: Routes = [
  { path: '', redirectTo: 'feature-requests', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login-page').then((m) => m.LoginPage),
  },
  {
    path: 'feature-requests',
    loadComponent: () =>
      import('./pages/request-list/request-list-page').then((m) => m.RequestListPage),
  },
  {
    path: 'feature-requests/new',
    loadComponent: () =>
      import('./pages/request-form/request-form-page').then((m) => m.RequestFormPage),
  },
  {
    path: 'feature-requests/:id',
    loadComponent: () =>
      import('./pages/request-detail/request-detail-page').then((m) => m.RequestDetailPage),
  },
  {
    path: 'feature-requests/:id/edit',
    loadComponent: () =>
      import('./pages/request-form/request-form-page').then((m) => m.RequestFormPage),
  },
  {
    path: 'admin',
    loadComponent: () =>
      import('./pages/admin-dashboard/admin-dashboard-page').then((m) => m.AdminDashboardPage),
  },
  { path: '**', redirectTo: 'feature-requests' },
];
