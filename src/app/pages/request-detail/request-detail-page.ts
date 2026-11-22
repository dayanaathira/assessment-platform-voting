import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { catchError, combineLatest, EMPTY, map, startWith, Subject, switchMap, tap } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { FeatureRequestService } from '../../core/feature-request.service';
import { errorMessage } from '../../core/http-error';
import { FeatureRequest, RequestMerge, VoteResult } from '../../core/models';
import { StatusBadge } from '../../shared/status-badge';
import { ConfirmService } from '../../shared/confirm.service';
import { VoteButton } from '../../shared/vote-button';
import { AdminPanel } from './admin-panel';
import { CommentSection } from './comment-section';

@Component({
  selector: 'app-request-detail-page',
  imports: [RouterLink, DatePipe, StatusBadge, VoteButton, AdminPanel, CommentSection],
  templateUrl: './request-detail-page.html',
  styleUrl: './request-detail-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestDetailPage {
  private readonly service = inject(FeatureRequestService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(ConfirmService);
  private readonly reload$ = new Subject<void>();
  protected readonly auth = inject(AuthService);

  // Bound from the :id route param.
  readonly id = input.required<string>();

  protected readonly request = signal<FeatureRequest | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly actionError = signal('');
  protected readonly deleting = signal(false);
  protected readonly mergeResult = signal<RequestMerge | null>(null);

  // Merged requests are read-only: no votes, comments, edits or admin changes.
  protected readonly isMerged = computed(() => !!this.request()?.mergedInto);
  protected readonly isOwner = computed(() => {
    const request = this.request();
    return !!request && request.createdBy.id === this.auth.user()?.id;
  });
  protected readonly voteState = computed(() => {
    const request = this.request();
    return request && { ...request, canVote: request.canVote && !request.mergedInto };
  });

  constructor() {
    // A new id (e.g. following the merged banner) starts clean; a reload keeps the page on screen.
    const id$ = toObservable(this.id).pipe(
      tap(() => {
        this.request.set(null);
        this.mergeResult.set(null);
      }),
    );
    combineLatest([id$, this.reload$.pipe(startWith(null))])
      .pipe(
        map(([id]) => id),
        tap(() => {
          this.loading.set(true);
          this.error.set('');
        }),
        switchMap((id) =>
          this.service.get(id).pipe(
            catchError((err) => {
              this.error.set(errorMessage(err));
              this.loading.set(false);
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((request) => {
        this.request.set(request);
        this.loading.set(false);
      });
  }

  /**
   * Applies the server's vote result.
   * @param result - New count and vote state.
   * @returns Nothing.
   */
  protected onVoted(result: VoteResult): void {
    this.request.update((request) => request && { ...request, ...result });
  }

  /**
   * Bumps the comment count after a comment is posted.
   * @returns Nothing.
   */
  protected onCommentAdded(): void {
    this.request.update((request) => request && { ...request, commentCount: request.commentCount + 1 });
  }

  /**
   * Shows what moved and reloads, so the merged banner appears.
   * @param result - The merge record.
   * @returns Nothing.
   */
  protected onMerged(result: RequestMerge): void {
    this.mergeResult.set(result);
    this.reload$.next();
  }

  /**
   * Deletes the request after the author confirms.
   * @returns Nothing.
   */
  protected async remove(): Promise<void> {
    const request = this.request();
    if (!request) {
      return;
    }
    const ok = await this.dialog.confirm({
      title: 'Delete request?',
      message: `"${request.title}" will be removed for everyone. This can't be undone.`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) {
      return;
    }

    this.deleting.set(true);
    this.actionError.set('');
    this.service
      .remove(request.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.router.navigate(['/feature-requests']),
        error: (err) => {
          this.deleting.set(false);
          this.actionError.set(errorMessage(err));
        },
      });
  }
}
