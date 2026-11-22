import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  danger?: boolean;
}

// Drives the single <app-confirm-dialog> rendered in the app shell.
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly current = signal<ConfirmOptions | null>(null);
  private resolve?: (ok: boolean) => void;

  /**
   * Opens the confirm dialog.
   * @param options - Title, message and button style.
   * @returns True if the user confirmed, false if they cancelled.
   */
  confirm(options: ConfirmOptions): Promise<boolean> {
    this.resolve?.(false);
    this.current.set(options);
    return new Promise((resolve) => (this.resolve = resolve));
  }

  /**
   * Closes the dialog with the user's answer. Safe to call twice.
   * @param ok - Whether the user confirmed.
   * @returns Nothing.
   */
  close(ok: boolean): void {
    this.resolve?.(ok);
    this.resolve = undefined;
    this.current.set(null);
  }
}
