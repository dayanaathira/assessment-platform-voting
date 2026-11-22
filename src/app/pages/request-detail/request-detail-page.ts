import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-request-detail-page',
  template: `<h1>Request detail</h1>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestDetailPage {}
