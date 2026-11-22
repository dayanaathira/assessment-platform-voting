import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { API_URL } from './api';
import { ApiResponse, FeatureRequest, RequestMerge } from './models';

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
}
