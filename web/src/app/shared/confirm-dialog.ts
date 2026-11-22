import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationStart, Router } from '@angular/router';
import { filter } from 'rxjs';
import { ConfirmService } from './confirm.service';

// Native <dialog> + showModal() gives focus trapping, Esc to close and a backdrop for free.
@Component({
  selector: 'app-confirm-dialog',
  template: `
    <dialog
      #dialog
      aria-labelledby="confirm-title"
      aria-describedby="confirm-message"
      (close)="confirm.close(false)"
      (click)="onClick($event)"
    >
      @if (confirm.current(); as options) {
        <div class="content">
          <h2 id="confirm-title">{{ options.title }}</h2>
          <p id="confirm-message">{{ options.message }}</p>
          <div class="actions">
            <button type="button" autofocus (click)="confirm.close(false)">Cancel</button>
            <button
              type="button"
              [class]="options.danger ? 'btn-danger' : 'btn-primary'"
              (click)="confirm.close(true)"
            >
              {{ options.confirmText ?? 'Confirm' }}
            </button>
          </div>
        </div>
      }
    </dialog>
  `,
  styles: `
    dialog {
      width: min(440px, calc(100vw - 2rem));
      padding: 0;
      border: none;
      border-radius: 12px;
      box-shadow: 0 20px 50px rgb(0 0 0 / 0.25);
      color: var(--text);
    }
    dialog::backdrop {
      background: rgb(15 23 42 / 0.5);
    }
    .content {
      padding: 1.5rem;
    }
    h2 {
      margin: 0 0 0.5rem;
      font-size: 1.15rem;
    }
    p {
      margin: 0 0 1.5rem;
      color: var(--muted);
      white-space: pre-line;
      overflow-wrap: anywhere;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialog {
  protected readonly confirm = inject(ConfirmService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    // Leaving the page (e.g. browser Back) cancels, so a late confirm can't act on a page that's gone.
    inject(Router)
      .events.pipe(
        filter((event) => event instanceof NavigationStart),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.confirm.close(false));

    // After render, so the buttons exist and Cancel gets autofocus when it opens.
    afterRenderEffect(() => {
      const dialog = this.dialog().nativeElement;
      const open = this.confirm.current() !== null;
      if (open && !dialog.open) {
        dialog.showModal();
      } else if (!open && dialog.open) {
        dialog.close();
      }
    });
  }

  /**
   * Treats a click on the backdrop as Cancel. The content box covers the dialog, so the
   * dialog itself is only the target when the click lands outside it.
   * @param event - Click inside the dialog element.
   * @returns Nothing.
   */
  protected onClick(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) {
      this.confirm.close(false);
    }
  }
}
