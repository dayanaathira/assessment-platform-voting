import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { API_URL } from './api';
import { toApiDate } from './api-date';
import { ApiResponse, FeatureRequest, Report, RequestMerge } from './models';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/admin/feature-request`;

  /**
   * Changes a request's status.
   * @param id - Feature request id.
   * @param statusId - New status id.
   * @returns The updated request.
   */
  updateStatus(id: string, statusId: number): Observable<FeatureRequest> {
    return this.http
      .patch<ApiResponse<FeatureRequest>>(`${this.url}/${id}/status`, { statusId })
      .pipe(map((res) => res.data));
  }

  /**
   * Sets or replaces the official response.
   * @param id - Feature request id.
   * @param response - Response text.
   * @returns The updated request.
   */
  setResponse(id: string, response: string): Observable<FeatureRequest> {
    return this.http
      .put<ApiResponse<FeatureRequest>>(`${this.url}/${id}/response`, { response })
      .pipe(map((res) => res.data));
  }

  /**
   * Merges a duplicate into another request; votes and comments move to the target.
   * @param sourceId - The duplicate.
   * @param targetId - The request to keep.
   * @returns The merge record with moved counts.
   */
  merge(sourceId: string, targetId: string): Observable<RequestMerge> {
    return this.http
      .post<ApiResponse<RequestMerge>>(`${this.url}/${sourceId}/merge`, { targetId })
      .pipe(map((res) => res.data));
  }

  /**
   * Usage statistics, optionally limited to requests created in a date range.
   * @param fromDate - Earliest created date (yyyy-mm-dd), inclusive.
   * @param toDate - Latest created date (yyyy-mm-dd), inclusive.
   * @returns Totals, counts by status, top voted and requests waiting for review.
   */
  report(fromDate?: string, toDate?: string): Observable<Report> {
    let params = new HttpParams();
    const from = toApiDate(fromDate);
    const to = toApiDate(toDate);
    if (from) {
      params = params.set('fromDate', from);
    }
    if (to) {
      params = params.set('toDate', to);
    }
    return this.http
      .get<ApiResponse<Report>>(`${API_URL}/admin/reporting`, { params })
      .pipe(map((res) => res.data));
  }
}
