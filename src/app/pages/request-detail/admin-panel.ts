import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, debounceTime, finalize, map, Observable, of, switchMap } from 'rxjs';
import { AdminService } from '../../core/admin.service';
import { FeatureRequestService } from '../../core/feature-request.service';
import { errorMessage } from '../../core/http-error';
import { FeatureRequest, RequestMerge } from '../../core/models';
import { ConfirmService } from '../../shared/confirm.service';

const MAX_LENGTH = 2000;

// Shown to admins only, which is cosmetic: every action here is checked by the API's RolesGuard.
@Component({
  selector: 'app-admin-panel',
  imports: [ReactiveFormsModule],
  templateUrl: './admin-panel.html',
  styleUrl: './admin-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminPanel {
  private readonly admin = inject(AdminService);
  private readonly requests = inject(FeatureRequestService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(ConfirmService);

  readonly request = input.required<FeatureRequest>();
  readonly updated = output<FeatureRequest>();
  readonly merged = output<RequestMerge>();

  protected readonly maxLength = MAX_LENGTH;
  protected readonly statuses = toSignal(this.requests.statuses$, { initialValue: [] });
  protected readonly statusId = new FormControl(0, { nonNullable: true });
  protected readonly response = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(MAX_LENGTH)],
  });
  protected readonly search = new FormControl('', { nonNullable: true });

  protected readonly busy = signal<'status' | 'response' | 'merge' | null>(null);
  protected readonly message = signal('');
  protected readonly error = signal('');

  // Merge candidates: other open requests matching the search, newest search wins.
  protected readonly candidates = toSignal(
    this.search.valueChanges.pipe(
      debounceTime(300),
      map((q) => q.trim()),
      switchMap((q) =>
        q
          ? this.requests.list({ q, limit: 5 }).pipe(
              map((page) => page.items.filter((item) => item.id !== this.request().id)),
              catchError(() => of([])),
            )
          : of([]),
      ),
    ),
    { initialValue: [] },
  );

  constructor() {
    // Keep the forms in step with the saved request.
    effect(() => {
      const request = this.request();
      this.statusId.setValue(request.status.id);
      this.response.setValue(request.officialResponse ?? '');
    });
  }

  /**
   * Saves the selected status.
   * @returns Nothing.
   */
  protected saveStatus(): void {
    this.run('status', this.admin.updateStatus(this.request().id, Number(this.statusId.value)), (req) => {
      this.updated.emit(req);
      this.message.set(`Status changed to ${req.status.name}.`);
    });
  }

  /**
   * Saves the official response.
   * @returns Nothing.
   */
  protected saveResponse(): void {
    if (this.response.invalid) {
      this.response.markAsTouched();
      return;
    }
    this.run('response', this.admin.setResponse(this.request().id, this.response.value.trim()), (req) => {
      this.updated.emit(req);
      this.message.set('Official response saved.');
    });
  }

  /**
   * Merges this request into the chosen one after the admin confirms.
   * @param target - The request to keep.
   * @returns Nothing.
   */
  protected async mergeInto(target: FeatureRequest): Promise<void> {
    const ok = await this.dialog.confirm({
      title: 'Merge requests?',
      message: `"${this.request().title}" will be merged into "${target.title}".\n\nIts votes and comments move to the target. This can't be undone.`,
      confirmText: 'Merge',
      danger: true,
    });
    if (!ok) {
      return;
    }
    this.run('merge', this.admin.merge(this.request().id, target.id), (result) => {
      this.search.setValue('');
      this.merged.emit(result);
    });
  }

  /**
   * Runs one admin call with shared busy, success and error handling.
   * @param action - Which action is running.
   * @param call - The API call.
   * @param done - Success handler.
   * @returns Nothing.
   */
  private run<T>(
    action: 'status' | 'response' | 'merge',
    call: Observable<T>,
    done: (result: T) => void,
  ): void {
    this.busy.set(action);
    this.message.set('');
    this.error.set('');
    call
      .pipe(
        finalize(() => this.busy.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({ next: done, error: (err) => this.error.set(errorMessage(err)) });
  }
}
