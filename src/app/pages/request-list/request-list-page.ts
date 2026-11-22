import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-request-list-page',
  template: `<h1>Feature requests</h1>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestListPage {}
