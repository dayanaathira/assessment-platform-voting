import { ParamMap } from '@angular/router';
import { isoDateOrUndefined } from '../../core/api-date';
import { FeatureRequest, FeatureRequestQuery } from '../../core/models';

export const PAGE_SIZE = 10;
// The API caps offset at 10000.
const MAX_PAGE = 10000 / PAGE_SIZE + 1;

/**
 * Reads the list query from the URL, dropping values the API would reject.
 * @param params - Current query params.
 * @returns The list query.
 */
export function toQuery(params: ParamMap): FeatureRequestQuery {
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
export function toForm(query: FeatureRequestQuery) {
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
export function byVotes(a: FeatureRequest, b: FeatureRequest): number {
  return (
    b.voteCount - a.voteCount || b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)
  );
}
