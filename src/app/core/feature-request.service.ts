import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable, shareReplay } from 'rxjs';
import { API_URL } from './api';
import {
  ApiResponse,
  Comment,
  FeatureRequest,
  FeatureRequestInput,
  FeatureRequestQuery,
  Page,
  Status,
  VoteResult,
} from './models';

@Injectable({ providedIn: 'root' })
export class FeatureRequestService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/feature-request`;

  // Statuses are fixed reference data, so they're fetched once and shared.
  readonly statuses$: Observable<Status[]> = this.http
    .get<ApiResponse<Status[]>>(`${this.url}/status`)
    .pipe(
      map((res) => res.data),
      shareReplay(1),
    );

  /**
   * One page of requests.
   * @param query - Filters, sort and paging; dates as yyyy-mm-dd.
   * @returns The page and the total match count.
   */
  list(query: FeatureRequestQuery): Observable<Page<FeatureRequest>> {
    return this.http
      .get<ApiResponse<Page<FeatureRequest>>>(this.url, { params: toParams(query) })
      .pipe(map((res) => res.data));
  }

  /**
   * One request with the user's vote state and merge links.
   * @param id - Feature request id.
   * @returns The request.
   */
  get(id: string): Observable<FeatureRequest> {
    return this.http
      .get<ApiResponse<FeatureRequest>>(`${this.url}/${id}`)
      .pipe(map((res) => res.data));
  }

  /**
   * Creates a request as the signed-in user.
   * @param body - Title and description.
   * @returns The created request.
   */
  create(body: FeatureRequestInput): Observable<FeatureRequest> {
    return this.http.post<ApiResponse<FeatureRequest>>(this.url, body).pipe(map((res) => res.data));
  }

  /**
   * Edits a request. The API allows the author only.
   * @param id - Feature request id.
   * @param body - Title and description.
   * @returns The updated request.
   */
  update(id: string, body: FeatureRequestInput): Observable<FeatureRequest> {
    return this.http
      .patch<ApiResponse<FeatureRequest>>(`${this.url}/${id}`, body)
      .pipe(map((res) => res.data));
  }

  /**
   * Soft-deletes a request. The API allows the author only.
   * @param id - Feature request id.
   * @returns Completes when deleted.
   */
  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  /**
   * One page of comments, newest first.
   * @param id - Feature request id.
   * @param limit - Page size.
   * @param offset - Comments to skip.
   * @returns The page and the total count.
   */
  comments(id: string, limit: number, offset: number): Observable<Page<Comment>> {
    return this.http
      .get<ApiResponse<Page<Comment>>>(`${this.url}/${id}/comments`, { params: { limit, offset } })
      .pipe(map((res) => res.data));
  }

  /**
   * Adds a comment.
   * @param id - Feature request id.
   * @param body - Comment text.
   * @returns The created comment.
   */
  addComment(id: string, body: string): Observable<Comment> {
    return this.http
      .post<ApiResponse<Comment>>(`${this.url}/${id}/comments`, { body })
      .pipe(map((res) => res.data));
  }

  /**
   * Adds the user's vote.
   * @param id - Feature request id.
   * @returns The new count and vote state.
   */
  vote(id: string): Observable<VoteResult> {
    return this.http
      .put<ApiResponse<VoteResult>>(`${this.url}/${id}/vote`, null)
      .pipe(map((res) => res.data));
  }

  /**
   * Removes the user's vote.
   * @param id - Feature request id.
   * @returns The new count and vote state.
   */
  unvote(id: string): Observable<VoteResult> {
    return this.http
      .delete<ApiResponse<VoteResult>>(`${this.url}/${id}/vote`)
      .pipe(map((res) => res.data));
  }
}

/**
 * Builds query params, skipping empty values and converting dates to the API's DD-MM-YYYY.
 * @param query - List query.
 * @returns The HTTP params.
 */
function toParams(query: FeatureRequestQuery): HttpParams {
  const values: Record<string, string | number | undefined> = {
    ...query,
    fromDate: toApiDate(query.fromDate),
    toDate: toApiDate(query.toDate),
  };

  let params = new HttpParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== '') {
      params = params.set(key, value);
    }
  }
  return params;
}

/**
 * Converts yyyy-mm-dd (what date inputs give) to DD-MM-YYYY.
 * @param date - ISO date, or undefined.
 * @returns The API date, or undefined.
 */
function toApiDate(date?: string): string | undefined {
  if (!date) {
    return undefined;
  }
  const [year, month, day] = date.split('-');
  return `${day}-${month}-${year}`;
}
