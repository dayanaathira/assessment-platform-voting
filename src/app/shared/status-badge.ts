import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Status } from '../core/models';

// Colour is decoration only; the status name is always shown as text.
@Component({
  selector: 'app-status-badge',
  template: `{{ status().name }}`,
  styles: `
    :host {
      display: inline-block;
      padding: 0.1rem 0.6rem;
      border-radius: 999px;
      font-size: 0.8rem;
      font-weight: 600;
      background: #eef0f3;
      color: #3d4654;
    }
    :host([data-status='2']) { background: #e6eefc; color: #1f4bb8; }
    :host([data-status='3']) { background: #fff3dc; color: #8a5a00; }
    :host([data-status='4']) { background: #e3f4e8; color: #1d6b35; }
    :host([data-status='5']) { background: #fbe9e9; color: #9b1c1c; }
  `,
  host: { '[attr.data-status]': 'status().id' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusBadge {
  readonly status = input.required<Status>();
}
