import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-admin-dashboard-page',
  template: `<h1>Admin dashboard</h1>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDashboardPage {}
