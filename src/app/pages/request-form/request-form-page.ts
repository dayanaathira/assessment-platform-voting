import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, EMPTY, filter, finalize, switchMap, tap } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { FeatureRequestService } from '../../core/feature-request.service';
import { errorMessage } from '../../core/http-error';

// Same limits as the API's AddFeatureRequestDto.
const TITLE_MAX = 255;
const DESCRIPTION_MAX = 2000;
const NOT_BLANK = Validators.pattern(/\S/);

@Component({
  selector: 'app-request-form-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './request-form-page.html',
  styleUrl: './request-form-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestFormPage {
  private readonly service = inject(FeatureRequestService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  // Bound from :id on the edit route; undefined on /new.
  readonly id = input<string>();

  protected readonly isEdit = computed(() => !!this.id());
  protected readonly titleMax = TITLE_MAX;
  protected readonly descriptionMax = DESCRIPTION_MAX;
  protected readonly form = inject(NonNullableFormBuilder).group({
    title: ['', [Validators.required, NOT_BLANK, Validators.maxLength(TITLE_MAX)]],
    description: ['', [Validators.required, NOT_BLANK, Validators.maxLength(DESCRIPTION_MAX)]],
  });
  protected readonly loading = signal(false);
  protected readonly loadError = signal('');
  protected readonly saving = signal(false);
  protected readonly saveError = signal('');

  constructor() {
    toObservable(this.id)
      .pipe(
        filter((id): id is string => !!id),
        tap(() => {
          this.loading.set(true);
          this.loadError.set('');
        }),
        switchMap((id) =>
          this.service.get(id).pipe(
            catchError((err) => {
              this.loadError.set(errorMessage(err));
              this.loading.set(false);
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((request) => {
        this.loading.set(false);
        // Cosmetic: the API returns 403/409 for these anyway.
        if (request.createdBy.id !== this.auth.user()?.id) {
          this.loadError.set('Only the author can edit this request.');
        } else if (request.mergedInto) {
          this.loadError.set('Merged requests cannot be edited.');
        } else {
          this.form.setValue({ title: request.title, description: request.description });
        }
      });
  }

  /**
   * Whether to show a field's error: only after the user has touched it.
   * @param name - Form control name.
   * @returns True when the field is invalid and touched.
   */
  protected showError(name: 'title' | 'description'): boolean {
    const control = this.form.controls[name];
    return control.invalid && control.touched;
  }

  /**
   * Creates or updates the request, then opens its detail page.
   * @returns Nothing.
   */
  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { title, description } = this.form.getRawValue();
    const body = { title: title.trim(), description: description.trim() };
    const id = this.id();
    this.saving.set(true);
    this.saveError.set('');
    (id ? this.service.update(id, body) : this.service.create(body))
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (request) => this.router.navigate(['/feature-requests', request.id]),
        error: (err) => this.saveError.set(errorMessage(err)),
      });
  }
}
