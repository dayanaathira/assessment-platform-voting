/**
 * Concurrency guarantees, against a deployed instance over HTTP.
 *
 * The unit tests prove the right lock and `ON CONFLICT` are requested; these
 * prove Postgres honours them. Every burst is sent with `Promise.all`, so all
 * requests are in flight together.
 *
 * Writes to the target: 50 `lt.*` users (created once, reused) and a few
 * `[Concurrency test]` requests per run.
 *
 *   LIVE_ADMIN_PASSWORD=… LIVE_TEST_USER_PASSWORD=… npm run test:live
 */

const BASE_URL = `${process.env.LIVE_BASE_URL ?? 'https://dayana.cloud'}/feature-voting/v1`;
const ADMIN_USERNAME = process.env.LIVE_ADMIN_USERNAME ?? 'admin';
const ADMIN_PASSWORD = process.env.LIVE_ADMIN_PASSWORD ?? '';
const USER_PASSWORD = process.env.LIVE_TEST_USER_PASSWORD ?? '';

const FIRST_NAMES = [
  'Aisyah',
  'Hafiz',
  'Mei Ling',
  'Arjun',
  'Nurul',
  'Daniel',
  'Siti',
  'Kumar',
  'Farah',
  'Wei Jie',
];
const LAST_NAMES = ['Rahman', 'Tan', 'Pillai', 'Ismail', 'Lim'];

const USERS = FIRST_NAMES.flatMap((first) =>
  LAST_NAMES.map((last) => ({
    name: `${first} ${last}`,
    username: `lt.${first}.${last}`.toLowerCase().replace(/ /g, ''),
  })),
);

interface ApiResult<T = any> {
  status: number;
  data: T;
}

/**
 * Calls the API and returns the HTTP status with the response's `data`.
 *
 * @param method HTTP method.
 * @param path Path under `/feature-voting/v1`.
 * @param token Bearer access token, if the route needs one.
 * @param body JSON body, if any.
 * @returns The status code and `data` (undefined for error responses).
 */
async function api<T = any>(
  method: string,
  path: string,
  token?: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, data: json.data };
}

/**
 * Counts results per status code, e.g. `{ 200: 1, 409: 9 }`. An unexpected
 * 429 or 5xx shows up in the diff instead of hiding inside a count.
 *
 * @param results Results of one burst.
 * @returns Number of results per status code.
 */
function statusCounts(results: ApiResult[]): Record<number, number> {
  const counts: Record<number, number> = {};
  for (const { status } of results) {
    counts[status] = (counts[status] ?? 0) + 1;
  }
  return counts;
}

/**
 * Logs in and returns the token pair.
 *
 * @param username Username.
 * @param password Password.
 * @returns The access and refresh tokens.
 */
async function login(
  username: string,
  password: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const res = await api('POST', '/auth/login', undefined, {
    username,
    password,
  });
  if (res.status !== 200) {
    throw new Error(`Login as ${username} failed with ${res.status}`);
  }
  return res.data;
}

describe('concurrency (live)', () => {
  let adminToken: string;
  let tokens: string[];
  let ownerToken: string;

  /**
   * Creates a request owned by the first test user.
   *
   * @param title Title after the `[Concurrency test]` prefix.
   * @returns The new request's id.
   */
  const createRequest = async (title: string): Promise<string> => {
    const res = await api('POST', '/feature-request', ownerToken, {
      title: `[Concurrency test] ${title}`,
      description:
        'Created by the live concurrency suite to check vote, comment and merge counts under parallel requests.',
    });
    expect(res.status).toBe(201);
    return res.data.id;
  };

  /**
   * Reads a request's current counts.
   *
   * @param id Request id.
   * @returns The request detail.
   */
  const detail = async (id: string) =>
    (await api('GET', `/feature-request/${id}`, adminToken)).data;

  /**
   * Sends a vote or unvote for each given user, all at once.
   *
   * @param method `PUT` to vote, `DELETE` to unvote.
   * @param id Request id.
   * @param userTokens Access tokens of the voters.
   * @returns One result per voter.
   */
  const voteBurst = (
    method: 'PUT' | 'DELETE',
    id: string,
    userTokens: string[],
  ) =>
    Promise.all(
      userTokens.map((t) => api(method, `/feature-request/${id}/vote`, t)),
    );

  beforeAll(async () => {
    if (!ADMIN_PASSWORD || !USER_PASSWORD) {
      throw new Error('Set LIVE_ADMIN_PASSWORD and LIVE_TEST_USER_PASSWORD');
    }

    adminToken = (await login(ADMIN_USERNAME, ADMIN_PASSWORD)).accessToken;

    // One at a time: every create and login is a bcrypt hash on the server.
    tokens = [];
    for (const user of USERS) {
      const created = await api('POST', '/user', adminToken, {
        ...user,
        password: USER_PASSWORD,
      });
      if (created.status !== 201 && created.status !== 409) {
        throw new Error(
          `Creating ${user.username} failed with ${created.status}`,
        );
      }
      tokens.push((await login(user.username, USER_PASSWORD)).accessToken);
    }
    ownerToken = tokens[0];
  }, 180_000);

  it('counts 50 concurrent voters exactly once each', async () => {
    const id = await createRequest('Export votes to CSV');

    const results = await voteBurst('PUT', id, tokens);

    expect(statusCounts(results)).toEqual({ 200: 50 });
    // Each vote saw the previous one's count, so the counts are 1..50 with no repeats.
    const counts = results.map((r) => r.data.voteCount).sort((a, b) => a - b);
    expect(counts).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
    expect((await detail(id)).voteCount).toBe(50);
  }, 60_000);

  it('accepts one of 10 concurrent votes by the same user, and unvotes back to 0', async () => {
    const id = await createRequest('Dark mode for the dashboard');
    const sameUser = Array<string>(10).fill(tokens[1]);

    const votes = await voteBurst('PUT', id, sameUser);
    expect(statusCounts(votes)).toEqual({ 200: 1, 409: 9 });
    expect((await detail(id)).voteCount).toBe(1);

    const unvotes = await voteBurst('DELETE', id, sameUser);
    expect(statusCounts(unvotes)).toEqual({ 200: 10 });
    expect((await detail(id)).voteCount).toBe(0);
  }, 60_000);

  it('ends at the right count when votes and unvotes race', async () => {
    const id = await createRequest('Slack notifications on status change');
    const leaving = tokens.slice(0, 25);
    const joining = tokens.slice(25);
    expect(statusCounts(await voteBurst('PUT', id, leaving))).toEqual({
      200: 25,
    });

    const results = await Promise.all([
      voteBurst('DELETE', id, leaving),
      voteBurst('PUT', id, joining),
    ]);

    expect(statusCounts(results.flat())).toEqual({ 200: 50 });
    expect((await detail(id)).voteCount).toBe(25);
  }, 60_000);

  it('counts 20 concurrent comments', async () => {
    const id = await createRequest('Attach screenshots to requests');

    const results = await Promise.all(
      tokens.slice(0, 20).map((t, i) =>
        api('POST', `/feature-request/${id}/comments`, t, {
          body: `We'd use this every week for bug reports (${i + 1}).`,
        }),
      ),
    );

    expect(statusCounts(results)).toEqual({ 201: 20 });
    expect((await detail(id)).commentCount).toBe(20);
    const list = await api(
      'GET',
      `/feature-request/${id}/comments`,
      adminToken,
    );
    expect(list.data.total).toBe(20);
  }, 60_000);

  it('lets a refresh token be used once under concurrent refreshes', async () => {
    const { refreshToken } = await login(USERS[2].username, USER_PASSWORD);

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        api('POST', '/auth/refresh', undefined, { refreshToken }),
      ),
    );

    expect(statusCounts(results)).toEqual({ 200: 1, 401: 4 });
  }, 60_000);

  it('applies one of 5 concurrent merges and counts overlapping voters once', async () => {
    const target = await createRequest('Single sign-on with Google');
    const source = await createRequest('Login with Google account');
    // Target voters 20..49, source voters 0..29: 10 overlap, 50 unique.
    await voteBurst('PUT', target, tokens.slice(20));
    await voteBurst('PUT', source, tokens.slice(0, 30));

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        api('POST', `/admin/feature-request/${source}/merge`, adminToken, {
          targetId: target,
        }),
      ),
    );

    expect(statusCounts(results)).toEqual({ 201: 1, 409: 4 });
    expect(results.find((r) => r.status === 201)!.data.votesMoved).toBe(20);
    expect((await detail(target)).voteCount).toBe(50);
    const merged = await detail(source);
    expect(merged.voteCount).toBe(0);
    expect(merged.mergedInto.id).toBe(target);
  }, 60_000);

  it('loses no vote that races a merge', async () => {
    const target = await createRequest('Weekly digest email');
    const source = await createRequest('Email summary of new requests');
    await voteBurst('PUT', target, tokens.slice(0, 10));

    const [votes, merge] = await Promise.all([
      voteBurst('PUT', source, tokens.slice(10, 30)),
      api('POST', `/admin/feature-request/${source}/merge`, adminToken, {
        targetId: target,
      }),
    ]);

    expect(merge.status).toBe(201);
    // Each vote landed before the merge (200, moved to the target) or after it (409).
    const counts = statusCounts(votes);
    expect((counts[200] ?? 0) + (counts[409] ?? 0)).toBe(20);
    expect(merge.data.votesMoved).toBe(counts[200] ?? 0);
    expect((await detail(target)).voteCount).toBe(10 + (counts[200] ?? 0));
  }, 60_000);

  it('rejects every concurrent admin call from a non-admin', async () => {
    const id = await createRequest('Bulk status updates');
    const user = tokens[3];

    const results = await Promise.all([
      api('PATCH', `/admin/feature-request/${id}/status`, user, {
        statusId: 2,
      }),
      api('PUT', `/admin/feature-request/${id}/response`, user, {
        response: 'Planned for next quarter.',
      }),
      api('POST', `/admin/feature-request/${id}/merge`, user, {
        targetId: id,
      }),
      api('GET', '/admin/reporting', user),
      api('POST', '/user', user, {
        name: 'Rina Kassim',
        username: 'rina.kassim',
        password: USER_PASSWORD,
      }),
    ]);

    expect(statusCounts(results)).toEqual({ 403: 5 });
  }, 60_000);
});
