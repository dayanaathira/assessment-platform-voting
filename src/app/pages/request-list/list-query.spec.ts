import { convertToParamMap } from '@angular/router';
import { FeatureRequest } from '../../core/models';
import { byVotes, PAGE_SIZE, toQuery } from './list-query';

describe('toQuery', () => {
  it('reads every filter from the URL', () => {
    const query = toQuery(
      convertToParamMap({
        q: '  dark mode ',
        status: '2',
        fromDate: '2026-11-01',
        toDate: '2026-11-30',
        sort: 'new',
        page: '3',
      }),
    );

    expect(query).toEqual({
      q: 'dark mode',
      status: 2,
      fromDate: '2026-11-01',
      toDate: '2026-11-30',
      sort: 'new',
      offset: 2 * PAGE_SIZE,
    });
  });

  it('falls back to defaults for an empty URL', () => {
    expect(toQuery(convertToParamMap({}))).toEqual({
      q: undefined,
      status: undefined,
      fromDate: undefined,
      toDate: undefined,
      sort: 'votes',
      offset: 0,
    });
  });

  it.each([
    ['a non-numeric status', { status: 'abc' }, { status: undefined }],
    ['a fractional status', { status: '1.5' }, { status: undefined }],
    ['a date in the wrong format', { fromDate: '01-11-2026' }, { fromDate: undefined }],
    ['an unknown sort', { sort: 'oldest' }, { sort: 'votes' }],
    ['a negative page', { page: '-1' }, { offset: 0 }],
    ['a non-numeric page', { page: 'two' }, { offset: 0 }],
    ['a whitespace-only search', { q: '   ' }, { q: undefined }],
  ])('drops %s', (_label, params, expected) => {
    expect(toQuery(convertToParamMap(params))).toMatchObject(expected);
  });

  it('caps the page so the offset stays within the API limit of 10000', () => {
    expect(toQuery(convertToParamMap({ page: '999999' })).offset).toBe(10000);
  });
});

describe('byVotes', () => {
  /**
   * @param id - Request id.
   * @param voteCount - Votes.
   * @param createdAt - ISO timestamp.
   * @returns A request with just the fields the sort reads.
   */
  function req(id: string, voteCount: number, createdAt: string): FeatureRequest {
    return { id, voteCount, createdAt } as FeatureRequest;
  }

  it('orders like the API: votes, then newest, then id, all descending', () => {
    const sorted = [
      req('a', 1, '2026-11-01T00:00:00.000Z'),
      req('b', 3, '2026-11-01T00:00:00.000Z'),
      req('c', 1, '2026-11-05T00:00:00.000Z'),
      req('d', 1, '2026-11-05T00:00:00.000Z'),
    ].sort(byVotes);

    expect(sorted.map((r) => r.id)).toEqual(['b', 'd', 'c', 'a']);
  });

  it('moves a request up as soon as it overtakes the one above', () => {
    const first = req('first', 1, '2026-11-02T00:00:00.000Z');
    const second = { ...req('second', 1, '2026-11-01T00:00:00.000Z') };
    expect([first, second].sort(byVotes).map((r) => r.id)).toEqual(['first', 'second']);

    second.voteCount = 2;
    expect([first, second].sort(byVotes).map((r) => r.id)).toEqual(['second', 'first']);
  });
});
