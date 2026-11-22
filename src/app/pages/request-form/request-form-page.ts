import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-request-form-page',
  template: `<h1>New request</h1>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestFormPage {}
