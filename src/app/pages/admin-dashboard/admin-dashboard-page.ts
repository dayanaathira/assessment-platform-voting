import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, combineLatest, EMPTY, map, startWith, Subject, switchMap, tap } from 'rxjs';
import { AdminService } from '../../core/admin.service';
import { isoDateOrUndefined } from '../../core/api-date';
import { errorMessage } from '../../core/http-error';
import { Report } from '../../core/models';
import { StatusBadge } from '../../shared/status-badge';

const UNDER_REVIEW = 1;

@Component({
  selector: 'app-admin-dashboard-page',
  imports: [ReactiveFormsModule, RouterLink, DatePipe, StatusBadge],
  templateUrl: './admin-dashboard-page.html',
  styleUrl: './admin-dashboard-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDashboardPage {
  private readonly admin = inject(AdminService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly reload$ = new Subject<void>();

  protected readonly range = inject(NonNullableFormBuilder).group({ fromDate: '', toDate: '' });
  protected readonly report = signal<Report | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal('');

  protected readonly awaitingReview = computed(
    () => this.report()?.byStatus.find((s) => s.id === UNDER_REVIEW)?.count ?? 0,
  );
  // Bars are scaled to the biggest status so the largest one fills the row.
  protected readonly maxStatusCount = computed(() =>
    Math.max(1, ...(this.report()?.byStatus.map((s) => s.count) ?? [])),
  );

  constructor() {
    // Same idea as the request list: the date range lives in the URL.
    const range$ = this.route.queryParamMap.pipe(
      map((params) => ({
        fromDate: isoDateOrUndefined(params.get('fromDate')),
        toDate: isoDateOrUndefined(params.get('toDate')),
      })),
    );
    combineLatest([range$, this.reload$.pipe(startWith(null))])
      .pipe(
        map(([range]) => range),
        tap((range) => {
          this.range.patchValue(
            { fromDate: range.fromDate ?? '', toDate: range.toDate ?? '' },
            { emitEvent: false },
          );
          this.loading.set(true);
          this.error.set('');
        }),
        switchMap(({ fromDate, toDate }) =>
          this.admin.report(fromDate, toDate).pipe(
            catchError((err) => {
              this.error.set(errorMessage(err));
              this.loading.set(false);
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((report) => {
        this.report.set(report);
        this.loading.set(false);
      });

    this.range.valueChanges.pipe(takeUntilDestroyed()).subscribe(({ fromDate, toDate }) => {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { fromDate: fromDate || null, toDate: toDate || null },
        replaceUrl: true,
      });
    });
  }

  /**
   * Re-runs the report after an error.
   * @returns Nothing.
   */
  protected retry(): void {
    this.reload$.next();
  }

  /**
   * Clears the date range.
   * @returns Nothing.
   */
  protected clearRange(): void {
    this.router.navigate([], { relativeTo: this.route });
  }
}
