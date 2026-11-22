import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-login-page',
  template: `<h1>Sign in</h1>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {}
