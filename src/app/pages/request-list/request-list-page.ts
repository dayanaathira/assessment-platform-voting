import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import {
  catchError,
  combineLatest,
  debounceTime,
  EMPTY,
  map,
  merge,
  startWith,
  Subject,
  switchMap,
  tap,
} from 'rxjs';
import { isoDateOrUndefined } from '../../core/api-date';
import { FeatureRequestService } from '../../core/feature-request.service';
import { errorMessage } from '../../core/http-error';
import {
  FeatureRequest,
  FeatureRequestQuery,
  FeatureRequestSort,
  VoteResult,
} from '../../core/models';
import { StatusBadge } from '../../shared/status-badge';
import { VoteButton } from '../../shared/vote-button';

const PAGE_SIZE = 20;

@Component({
  selector: 'app-request-list-page',
  imports: [ReactiveFormsModule, RouterLink, DatePipe, StatusBadge, VoteButton],
  templateUrl: './request-list-page.html',
  styleUrl: './request-list-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestListPage {
  private readonly service = inject(FeatureRequestService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reload$ = new Subject<void>();
  private query: FeatureRequestQuery = {};

  protected readonly statuses = toSignal(this.service.statuses$, { initialValue: [] });
  protected readonly filters = inject(NonNullableFormBuilder).group({
    q: '',
    status: '',
    fromDate: '',
    toDate: '',
    sort: 'votes' as FeatureRequestSort,
  });

  protected readonly items = signal<FeatureRequest[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly loadingMore = signal(false);
  protected readonly moreError = signal('');

  constructor() {
    // The URL is the source of truth: the form writes to it and the list reads from it,
    // so filters survive refresh, back/forward and shared links.
    combineLatest([this.route.queryParamMap.pipe(map(toQuery)), this.reload$.pipe(startWith(null))])
      .pipe(
        map(([query]) => query),
        tap((query) => {
          this.query = query;
          this.filters.patchValue(toForm(query), { emitEvent: false });
          this.loading.set(true);
          this.error.set('');
          this.moreError.set('');
        }),
        // switchMap drops the previous request, so a slow old response can't overwrite a newer one.
        switchMap((query) =>
          this.service.list({ ...query, limit: PAGE_SIZE, offset: 0 }).pipe(
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
        this.items.set(page.items);
        this.total.set(page.total);
        this.loading.set(false);
      });

    const { q, status, fromDate, toDate, sort } = this.filters.controls;
    merge(
      q.valueChanges.pipe(debounceTime(300)),
      status.valueChanges,
      fromDate.valueChanges,
      toDate.valueChanges,
      sort.valueChanges,
    )
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.applyFilters());
  }

  /**
   * Re-runs the current query after an error.
   * @returns Nothing.
   */
  protected retry(): void {
    this.reload$.next();
  }

  /**
   * Clears every filter back to the default view.
   * @returns Nothing.
   */
  protected clearFilters(): void {
    this.router.navigate([], { relativeTo: this.route });
  }

  /**
   * Appends the next page. Ignored if the filters changed while it was loading.
   * @returns Nothing.
   */
  protected loadMore(): void {
    const query = this.query;
    this.loadingMore.set(true);
    this.moreError.set('');
    this.service
      .list({ ...query, limit: PAGE_SIZE, offset: this.items().length })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.loadingMore.set(false);
          if (query !== this.query) {
            return;
          }
          // Votes can reorder rows between pages; skip any already shown.
          const shown = new Set(this.items().map((item) => item.id));
          this.items.update((items) => [...items, ...page.items.filter((i) => !shown.has(i.id))]);
          this.total.set(page.total);
        },
        error: (err) => {
          this.loadingMore.set(false);
          this.moreError.set(errorMessage(err));
        },
      });
  }

  /**
   * Updates one card with the server's vote result.
   * @param id - Feature request id.
   * @param result - New count and vote state.
   * @returns Nothing.
   */
  protected onVoted(id: string, result: VoteResult): void {
    this.items.update((items) => {
      const updated = items.map((item) => (item.id === id ? { ...item, ...result } : item));
      return this.query.sort === 'votes' ? updated.sort(byVotes) : updated;
    });
  }

  /**
   * Writes the form to the URL; the query param subscription then loads the list.
   * @returns Nothing.
   */
  private applyFilters(): void {
    const { q, status, fromDate, toDate, sort } = this.filters.getRawValue();
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: q.trim() || null,
        status: status || null,
        fromDate: fromDate || null,
        toDate: toDate || null,
        sort: sort === 'new' ? 'new' : null,
      },
      replaceUrl: true,
    });
  }
}

/**
 * Reads the list query from the URL, dropping values the API would reject.
 * @param params - Current query params.
 * @returns The list query.
 */
function toQuery(params: ParamMap): FeatureRequestQuery {
  const status = Number(params.get('status'));
  return {
    q: params.get('q')?.trim() || undefined,
    status: Number.isInteger(status) && status > 0 ? status : undefined,
    fromDate: isoDateOrUndefined(params.get('fromDate')),
    toDate: isoDateOrUndefined(params.get('toDate')),
    sort: params.get('sort') === 'new' ? 'new' : 'votes',
  };
}

/**
 * Maps the list query back onto the filter form.
 * @param query - The list query.
 * @returns Form values.
 */
function toForm(query: FeatureRequestQuery) {
  return {
    q: query.q ?? '',
    status: query.status ? String(query.status) : '',
    fromDate: query.fromDate ?? '',
    toDate: query.toDate ?? '',
    sort: query.sort ?? 'votes',
  };
}

/**
 * Same order as the API's "votes" sort: voteCount desc, then createdAt desc, then id desc.
 * @param a - First request.
 * @param b - Second request.
 * @returns Negative when a comes first.
 */
function byVotes(a: FeatureRequest, b: FeatureRequest): number {
  return (
    b.voteCount - a.voteCount || b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)
  );
}
