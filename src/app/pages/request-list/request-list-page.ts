import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
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

const PAGE_SIZE = 10;
// The API caps offset at 10000.
const MAX_PAGE = 10000 / PAGE_SIZE + 1;

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
  protected readonly page = signal(1);
  protected readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / PAGE_SIZE)));
  protected readonly firstShown = computed(() => (this.page() - 1) * PAGE_SIZE + 1);
  protected readonly lastShown = computed(() => this.firstShown() + this.items().length - 1);

  constructor() {
    // The URL is the source of truth: the form writes to it and the list reads from it,
    // so filters survive refresh, back/forward and shared links.
    combineLatest([this.route.queryParamMap.pipe(map(toQuery)), this.reload$.pipe(startWith(null))])
      .pipe(
        map(([query]) => query),
        tap((query) => {
          this.query = query;
          this.page.set((query.offset ?? 0) / PAGE_SIZE + 1);
          this.filters.patchValue(toForm(query), { emitEvent: false });
          this.loading.set(true);
          this.error.set('');
        }),
        // switchMap drops the previous request, so a slow old response can't overwrite a newer one.
        switchMap((query) =>
          this.service.list({ ...query, limit: PAGE_SIZE }).pipe(
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
        // Past the end (e.g. ?page=99, or the last item was deleted): go to the last page.
        if (page.items.length === 0 && page.total > 0 && this.page() > 1) {
          this.goToPage(Math.ceil(page.total / PAGE_SIZE), true);
          return;
        }
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
   * Moves to another page, keeping the filters.
   * @param page - 1-based page number.
   * @param replaceUrl - Replace the history entry instead of adding one.
   * @returns Nothing.
   */
  protected goToPage(page: number, replaceUrl = false): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: page > 1 ? page : null },
      queryParamsHandling: 'merge',
      replaceUrl,
    });
    window.scrollTo({ top: 0 });
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
   * Page is left out, so any filter change goes back to page 1.
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
  const page = Number(params.get('page'));
  return {
    q: params.get('q')?.trim() || undefined,
    status: Number.isInteger(status) && status > 0 ? status : undefined,
    fromDate: isoDateOrUndefined(params.get('fromDate')),
    toDate: isoDateOrUndefined(params.get('toDate')),
    sort: params.get('sort') === 'new' ? 'new' : 'votes',
    offset: Number.isInteger(page) && page > 1 ? (Math.min(page, MAX_PAGE) - 1) * PAGE_SIZE : 0,
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
