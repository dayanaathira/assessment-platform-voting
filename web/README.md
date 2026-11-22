# Feature Voting — Web

Angular frontend for the feature-voting platform: browse, search and vote on
feature requests, comment, and follow their status. Admins change status, post
official responses, merge duplicates and see usage statistics.

Angular 22 (standalone, zoneless) · Reactive Forms · RxJS + signals · plain CSS · nginx

The API, data model and integrity rules are in the
[API README](../feature-voting/README.md).

---

## Contents

- [Quick start](#quick-start)
- [Pages](#pages)
- [Architecture](#architecture)
- [State management](#state-management)
- [Auth on the client](#auth-on-the-client)
- [Feedback states](#feedback-states)
- [Accessibility](#accessibility)
- [Performance](#performance)
- [Security](#security)
- [Testing](#testing)
- [Decisions and rejected alternatives](#decisions-and-rejected-alternatives)
- [Scope](#scope)

---

## Quick start

**Prerequisites:** Node ^22.22.3, ^24.15 or ≥ 26 (Angular 22) and the API
running (see the API README).

```bash
npm ci
npm start              # http://localhost:4200
```

The dev server proxies `/feature-voting/*` to `http://localhost:3000`
([`proxy.conf.mjs`](proxy.conf.mjs)). To use an API elsewhere:

```bash
API_TARGET=http://10.0.0.5:3000 npm start
```

Log in with the seeded users from the API README (`admin`, `user1`–`user3`).

**Production build:** `npm run build` → `dist/web/browser`.

**Tests:** `npx ng test --watch=false` (Vitest + jsdom, no API needed). See [Testing](#testing).

**Docker:** a multi-stage image; Node builds, then non-root nginx serves the
static files on port 8080 and proxies the API.

```bash
docker build -t feature-voting-web .
docker run --rm -p 8080:8080 \
  -e API_UPSTREAM=host.docker.internal:3000 \
  --add-host=host.docker.internal:host-gateway \
  feature-voting-web
```

`API_UPSTREAM` defaults to `api:3000`, the API service in `docker-compose.yml`.

---

## Pages

| Path | Access | What it does |
| --- | --- | --- |
| `/login` | public | Sign in; explains an expired session and returns to the previous page |
| `/feature-requests` | user | Search, status, date range, sort; 10 per page; vote from the card |
| `/feature-requests/new` | user | Create a request |
| `/feature-requests/:id` | user | Detail, vote, official response, comments; merged banner; admin panel for admins |
| `/feature-requests/:id/edit` | user (author) | Edit; non-authors and merged requests get a message instead of the form |
| `/admin` | admin | Totals, requests by status, top voted, needs review; date range |

---

## Architecture

```
src/app/
  core/        services and app-wide plumbing, no UI
    auth.service.ts            tokens, user signal, login / refresh / logout
    auth.interceptor.ts        Bearer header, one refresh on 401, retry once
    auth.guard.ts              authGuard, adminGuard
    feature-request.service.ts list, get, create, update, delete, vote, comments
    admin.service.ts           status, official response, merge, report
    http-error.ts              API error → one display message
    api.ts, api-date.ts        API base path; yyyy-mm-dd ↔ DD-MM-YYYY
    models.ts                  interfaces mirroring the API DTOs
  shared/      reusable UI with no page knowledge
    vote-button, status-badge, confirm-dialog (+ confirm.service)
  pages/       one folder per route, lazy-loaded
    login, request-list (+ list-query: URL parsing and vote order),
    request-detail (+ comment-section, admin-panel),
    request-form, admin-dashboard
```

**Component boundaries.** A page owns its data. Children get data through
inputs and report results through outputs, and the page applies them. On the
detail page, `vote-button` emits `voted`, `comment-section` emits `added`, and
`admin-panel` emits `updated` and `merged`; only the page changes the request.
`shared/` components never call routes or know which page they're on.

**One form style.** Every form is a Reactive Form on a `[formGroup]`, with
validators that mirror the API DTOs (required, max length, not blank). The API
stays the authority; the client checks are for instant feedback.

---

## State management

| Kind of state | Where it lives |
| --- | --- |
| Server data | Fetched by services, held in page-level signals |
| Filters, sort, page, dashboard range | **The URL query string** |
| Signed-in user | A `computed` signal decoded from the access token |
| Async flows (search, loading, cancelling) | RxJS: `debounceTime`, `switchMap` |
| Statuses (reference data) | Fetched once and shared (`shareReplay`) |

- **The URL is the source of truth for the list.** The form writes to the
  query string and the list reads from it, so refresh, back/forward and shared
  links restore the same view. Changing a filter resets to page 1.
- **`switchMap` cancels stale requests.** Typing quickly can't let an older,
  slower response overwrite a newer one.
- **No global store.** Pages don't share mutable data; each loads what it
  shows. NgRx would add actions, reducers and effects for no benefit at this
  size.

---

## Auth on the client

- **Interceptor** adds `Authorization: Bearer …` to every call except
  login, refresh and logout.
- **On a 401** it calls `/auth/refresh` once and retries the request. Parallel
  401s share one refresh call. A second 401 on the retry is passed on, so there
  is no loop.
- **Refresh tokens rotate** (the API revokes each one on use). If another tab
  rotated the token first, this tab picks up the new pair from `localStorage`
  instead of logging out.
- **Session ended** (refresh fails): tokens are cleared and the user goes to
  `/login?expired=1&returnUrl=…`, sees "Your session has expired", and returns
  to the same page after signing in. `returnUrl` must be an app path (`/…`,
  not `//…`), so the link can't redirect off-site.
- **Log out** revokes the refresh token on the API (fire-and-forget) and clears
  local tokens.
- **Guards are cosmetic.** `authGuard` and `adminGuard` only shape navigation,
  and admin controls are hidden from users; the API enforces every rule.

---

## Feedback states

- Every page has **loading**, **empty** and **error** states; list and
  dashboard errors have **Retry**.
- Buttons are **disabled while their request is in flight**, so double clicks
  can't send twice.
- **Server messages are shown as is** (e.g. "You have already voted for this
  request", "Merged requests cannot be changed").
- **Voting is not optimistic.** The count shown is the one the server returns,
  so it can't drift from the database. When sorted by votes, the list re-sorts
  immediately with the API's order (`voteCount`, `createdAt`, `id`, all
  descending).
- **Destructive actions** (delete, merge) use a confirm dialog with Cancel
  focused by default.
- **Merges are visible:** after merging, the page shows how many votes and
  comments moved; the source shows a banner linking to the target, and the
  target lists what was merged into it.

---

## Accessibility

- Every input has a `<label>`; invalid fields set `aria-invalid` and point
  `aria-describedby` at their error and character counter.
- Errors and results are announced: `role="alert"` for errors, `aria-live`
  for the result count, form errors and admin messages.
- The vote toggle is a real `<button>` with `aria-pressed` and a label like
  "Vote for Dark mode, 12 votes".
- The confirm dialog is a native `<dialog>` opened with `showModal()`, which
  traps focus, closes on Esc and returns focus to the button that opened it.
- Pagination is a `<nav aria-label="Pagination">` with `aria-current="page"`.
- Status is always text; colour only reinforces it. Bars on the dashboard are
  `aria-hidden` next to the written count.
- Skip-to-content link, visible `:focus-visible` outline, semantic landmarks
  (`header`, `nav`, `main`, `section` with headings).

---

## Performance

- **Lazy routes:** first load is about **81 kB** transferred (gzip); each page
  is its own chunk of 1–5 kB.
- **Zoneless + `OnPush`:** views update only when a signal or bound observable
  changes; no zone.js in the bundle.
- **`@for … track item.id`:** after a vote re-sort, existing DOM nodes move
  instead of being re-created.
- **Debounced search** (300 ms) and **cancelled stale requests** keep request
  count low.
- **Statistics are aggregated by the API**; the dashboard makes one call.
- **nginx** gzips responses and caches hashed bundles for a year; `index.html`
  is never cached, so a deploy shows up immediately.
- No UI or chart library; the dashboard bars are CSS.

---

## Security

- **Content-Security-Policy** in nginx: `script-src 'self'`, no inline
  scripts, `frame-ancestors 'none'`, plus `nosniff`, `X-Frame-Options` and
  `Referrer-Policy`. `style-src` allows `'unsafe-inline'` because Angular
  injects component styles as `<style>` tags. Critical-CSS inlining is turned
  off in `angular.json` because it adds an inline script the CSP would block.
- **Angular escapes all template output;** the app never uses `innerHTML` or
  bypasses sanitisation.
- **Tokens are in `localStorage`.** Script injected through an XSS bug could
  read them. The CSP, Angular's escaping, 15-minute access tokens and
  single-use refresh tokens limit the damage. Moving the refresh token to an
  httpOnly cookie is a next step.
- **No secrets or URLs in the bundle.** The API is called on a relative path
  (`/feature-voting/v1`), so the same build works on any domain.
- **Rate limiting** is enforced at the edge (nginx / ingress / gateway), not in
  application code.

---

## Testing

**30 unit tests in 4 files** (Vitest through Angular's `unit-test` builder,
jsdom, `HttpTestingController`; no API or browser needed). They cover the
client logic that can break a session or show wrong data. The business rules
themselves are enforced and tested in the API.

| File | What it proves |
| --- | --- |
| `auth.interceptor.spec.ts` | Bearer token added; login / refresh / logout left alone; 401 → one refresh → retry with the new token; a second 401 is not refreshed again; failed refresh → logout as expired; other errors pass through |
| `auth.service.spec.ts` | Concurrent refreshes send **one** request; a token already rotated by another tab is picked up instead of logging out; normal logout revokes on the API; expired logout skips the call and keeps `returnUrl` |
| `list-query.spec.ts` | URL → query: bad status, dates, sort and page are dropped; page capped at the API's offset limit; vote re-sort matches the API order (votes, newest, id) |
| `vote-button.spec.ts` | `aria-pressed` and label; disabled when voting is closed and while a vote is in flight; vote vs unvote; emits the server result; shows the server's 409 message |

Each suite was checked by breaking the code it guards (dropping `logout` from
the interceptor's skip list, removing the multi-tab fallback, removing the
`createdAt` tie-break): the matching tests failed.

---

## Decisions and rejected alternatives

| Decision | Why | Rejected |
| --- | --- | --- |
| Services + signals + URL state | Enough for pages that don't share mutable data; easy to follow | NgRx: actions, reducers and effects for no shared state |
| Plain CSS with variables | Small bundle, full control, nothing to learn | Angular Material / Tailwind: size and setup for a handful of components |
| Relative API path + proxy (dev) / nginx (prod) | One build for every environment, no CORS | `environment.ts` per environment: a rebuild per domain |
| Non-optimistic voting | The shown count always matches the database | Optimistic update: faster feel, but needs rollback and can briefly show wrong totals |
| Numbered pages in the URL | Shareable, back/forward works, simpler than appending | Load more: harder to link to, and vote changes reorder rows between loads |
| Silent refresh + expired-session notice | Active users are never interrupted | "Session expiring, stay signed in?" popup: only useful with an idle-timeout policy, which this app doesn't have |
| Native `<dialog>` for confirms | Focus trap, Esc and backdrop built in | `window.confirm()`: unstyled; a UI library dialog: extra dependency |
| Tokens in `localStorage` | The API returns tokens in the body; simple | httpOnly cookie: safer against XSS, needs API changes and CSRF handling |

---

## Scope

**Complete**

- Login, silent refresh with rotation, logout with revocation, expired-session
  handling
- Request list with search, status, date range, sort, pagination and voting
- Request detail with vote, official response, comments, merge banner and
  links
- Create and edit (author only)
- Admin panel: status, official response, merge with confirmation
- Admin dashboard with totals, status breakdown, top voted and needs review
- Docker image with nginx, CSP and caching
- 30 unit tests for the interceptor, token refresh and logout, list URL
  parsing and the vote button

**Deferred**

- **Page-level component tests and end-to-end tests.** The unit tests cover
  the risky client logic; next would be page tests (list, detail, admin panel)
  and one end-to-end flow (login → create → vote → comment).
- Optimistic voting and real-time updates (other users' votes appear on
  reload).
- Numbered page buttons (only Previous / Next now).
- "Similar requests" hint while typing a new title.
- i18n and dark mode.

**Known limitations**

- Offset pagination: a vote by someone else between page loads can shift an
  item to the next page.
- Access tokens stay valid up to 15 minutes after logout (they are not checked
  against the database).
- Multi-tab token sharing works within one browser profile only.
- Silent refresh keeps a user signed in as long as they return within 7 days;
  there is no idle timeout or "Stay signed in?" prompt.
