import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, EMPTY, finalize, switchMap, tap } from 'rxjs';
import { FeatureRequestService } from '../../core/feature-request.service';
import { errorMessage } from '../../core/http-error';
import { Comment } from '../../core/models';

const PAGE_SIZE = 10;
const MAX_LENGTH = 2000;

@Component({
  selector: 'app-comment-section',
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './comment-section.html',
  styleUrl: './comment-section.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommentSection {
  private readonly service = inject(FeatureRequestService);
  private readonly destroyRef = inject(DestroyRef);

  readonly requestId = input.required<string>();
  readonly added = output<void>();

  protected readonly maxLength = MAX_LENGTH;
  protected readonly body = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(MAX_LENGTH)],
  });
  protected readonly comments = signal<Comment[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly loadingMore = signal(false);
  protected readonly posting = signal(false);
  protected readonly postError = signal('');

  constructor() {
    toObservable(this.requestId)
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set('');
        }),
        switchMap((id) =>
          this.service.comments(id, PAGE_SIZE, 0).pipe(
            catchError((err) => {
              this.error.set(errorMessage(err));
              this.loading.set(false);
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((page) => {
        this.comments.set(page.items);
        this.total.set(page.total);
        this.loading.set(false);
      });
  }

  /**
   * Appends the next page of older comments.
   * @returns Nothing.
   */
  protected loadMore(): void {
    this.loadingMore.set(true);
    this.service
      .comments(this.requestId(), PAGE_SIZE, this.comments().length)
      .pipe(
        finalize(() => this.loadingMore.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (page) => {
          // Comments posted since the first load shift the offset; skip ones already shown.
          const shown = new Set(this.comments().map((c) => c.id));
          this.comments.update((list) => [...list, ...page.items.filter((c) => !shown.has(c.id))]);
          this.total.set(page.total);
        },
        error: (err) => this.error.set(errorMessage(err)),
      });
  }

  /**
   * Posts the comment and puts it at the top of the list.
   * @returns Nothing.
   */
  protected post(): void {
    if (this.body.invalid) {
      this.body.markAsTouched();
      return;
    }

    this.posting.set(true);
    this.postError.set('');
    this.service
      .addComment(this.requestId(), this.body.value.trim())
      .pipe(
        finalize(() => this.posting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (comment) => {
          this.comments.update((list) => [comment, ...list]);
          this.total.update((n) => n + 1);
          this.body.reset();
          this.added.emit();
        },
        error: (err) => this.postError.set(errorMessage(err)),
      });
  }
}
