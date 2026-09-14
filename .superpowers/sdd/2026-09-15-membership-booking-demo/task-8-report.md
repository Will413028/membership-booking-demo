# Task 8 report

## Delivery commits

- Task 8: `d350226` — `test: add end to end acceptance coverage`
- Fix Round 1: `d248286` — `fix: harden e2e targets and booking states`

## Fix Round 1

### Implemented

- E2E setup now accepts only HTTP `localhost`/`127.0.0.1`/`::1` Supabase CLI URLs on port `54321` and local app URLs on port `3000`. Remote, shared, production, malformed, HTTPS, and wrong-port targets return an explicit skip prerequisite before reset or service-role seeding.
- `supabase db reset` remains the exact command and is pinned to the repository root cwd. No project-ref allowlist was added.
- Authenticated class-detail users receive a real `預約這堂課` client control backed by `createBooking`; it displays server-confirmed success or the action's stable error message. Full sessions are disabled. Unauthenticated visitors retain the safe login link.
- `/admin` redirects non-admin users to `/account`; known configuration failures use a safe visible configuration state.
- Marketing/admin error UIs and checkout success now recognize only known `CONFIGURATION_ERROR` values and never render raw errors or secrets. Checkout status polling explicitly displays `CONFIGURATION_ERROR` without claiming payment was processed.
- README and `.env.example` document the local-only E2E contract.

### Bounded verification executed

| Command | Outcome |
| --- | --- |
| `pnpm lint` | Passed: `tsc --noEmit` and `biome check src/`. |
| `pnpm build` | Passed. Next.js emitted the pre-existing middleware-to-proxy deprecation warning. |
| `pnpm exec playwright test --list` | Passed: collected 8 tests in 3 files. No browser was launched. |
| `git diff --check` | Passed before commit. |
| `pnpm test` | Did not pass/complete. It reported one failed test: `src/features/bookings/components/booking-button.test.tsx` — `shows the server action message and disables a full session`; the Vitest process then did not provide a completion summary within the bounded window and was terminated. Do not treat the suite as passing. |

### Not executed

- No Playwright browser run, browser installation, Supabase CLI, Docker, database reset, dev server, network operation, Stripe CLI forwarding, or Stripe/manual payment flow ran.
- Responsive viewport, keyboard, loading/empty/error manual UI checks were not run because they require the prohibited app/browser/database runtime.
- E2E runtime remains skipped unless all local-only guards and local credentials are deliberately supplied; no remote target was contacted.

This report is intentionally uncommitted. No ledger or wiki files were changed.

## Fix Round 2

### Implemented

- Updated the full-session E2E assertion to target the real disabled button name, `本堂已額滿`.
- Updated the booking-button component test's full-state assertion to the same accessible name. This removes the stale `預約這堂課` expectation that caused the previous focused test failure.

### Bounded verification

| Command | Outcome |
| --- | --- |
| `pnpm test` | Did not complete within the bounded 30-second window and emitted no test summary; process was terminated. |
| `pnpm test -- --pool=threads --maxWorkers=1 --minWorkers=1` | Did not complete within the bounded 30-second window and emitted no test summary; process was terminated. |
| `pnpm lint` | Passed: `tsc --noEmit` and `biome check src/`. |
| `pnpm build` | Passed. Only the existing Next middleware-to-proxy deprecation warning appeared. |
| `pnpm exec playwright test --list` | Passed: collected 8 tests in 3 files without launching a browser. |
| `git diff --check` | Passed before commit. |

### Deferred runtime verification

E2E browser execution, database/Supabase reset, Stripe CLI, Docker, network, dev server, and manual payment/viewport checks remain deferred: the required local runtime prerequisites are absent and these actions have side effects. No browser, DB, Stripe, Docker, or external service was started in this round.

## Fix Round 3

### Root cause and fix

`vitest.config.ts` had no `test.include`, so Vitest's default discovery included `e2e/*.spec.ts`. Those Playwright specs imported the Playwright fixture setup and left the Vitest fork workers idle after `RUN`; interrupting the process exited with code 130. The full-session selectors remain aligned with the real `本堂已額滿` accessible name from commit `2a6808c`.

Vitest discovery is now restricted to `src/**/*.{test,spec}.{ts,tsx}`. This preserves all source unit/component tests while preventing Playwright E2E specs from entering the Vitest runner.

### Exact verification

| Command | Outcome |
| --- | --- |
| `pnpm test` | Passed: 20 test files and 90 tests passed; exit code 0; duration 4.54s. |
| `pnpm lint` | Passed: `tsc --noEmit` and `biome check src/`. |
| `pnpm build` | Passed. Only the existing Next middleware-to-proxy deprecation warning appeared. |
| `pnpm exec playwright test --list` | Passed: collected 8 tests in 3 files without launching a browser. |
| `git diff --check` | Passed before commit. |

E2E browser, DB/Supabase reset, Stripe, Docker, network, dev server, and manual runtime checks remain deferred because their local prerequisites are absent and they have side effects. This report remains intentionally uncommitted.

## Fix Round 4

### Implemented

- `/classes` now recognizes `AuthError("CONFIGURATION_ERROR")` through `isConfigurationError(error)` and renders the shared safe `ConfigurationError` UI. Non-configuration query failures retain the existing generic class-schedule message.
- `/plans` now protects Supabase client creation, plan query, user lookup, and plan mapping in one safe boundary. Known configuration failures render `ConfigurationError`; all other failures and plan-query errors use the existing safe unavailable-plan message.
- Added minimal page tests for both configuration paths and a non-configuration `/classes` failure.

### Verification

| Command | Outcome |
| --- | --- |
| `pnpm test` | Passed: 22 test files and 93 tests passed; duration 4.99s. |
| `pnpm lint` | Passed: `tsc --noEmit` and `biome check src/`. |
| `pnpm build` | Passed. Only the existing Next middleware-to-proxy deprecation warning appeared. |
| `pnpm exec playwright test --list` | Passed: collected 8 tests in 3 files without launching a browser. |
| `git diff --check` | Passed before commit. |

E2E browser, Supabase/DB, Stripe, Docker, network, dev server, and manual runtime verification remain deferred because their prerequisites are absent and those workflows have side effects. This report remains intentionally uncommitted.

## Final remediation

This section supersedes earlier verification/deferred notes. Scope: existing `main` checkout at base `d1725961c3f8d6544e58805f0fb7d3f3a8640929`; one remediation commit, no worktree, parent/wiki edits, reset/stash/clean/force or push. Unrelated `supabase/.temp/` is preserved. All 15 findings were verified against implementation; none was dismissed as technically wrong. Self-review followed the code-review/verification skills; the independent scoped re-review is recorded below.

### Finding-by-finding self-review

Migration 003 below means `supabase/migrations/202609150003_final_integrity_hardening.sql`.

| Finding | Final implementation / evidence |
| --- | --- |
| C1 | Migration 003 explicitly revokes PUBLIC/anon/authenticated execution for both Stripe entrypoints; only service_role granted. Baseline actual `has_function_privilege` returned true for both anon and authenticated, confirming exploitability. Cancellation has explicit NULL auth.uid rejection and authenticated-only EXECUTE; direct membership/payment/booking writes revoked. pgTAP executes anon/member/admin role checks, not only catalog assertions. |
| C2 | SECURITY DEFINER auth.users INSERT trigger + existing-user backfill create member profiles, never metadata-selected admin. pgTAP checks normal insertion and malicious role metadata; UI registration E2E is authored but environment-limited. |
| I3 | Real profiles FKs on memberships/bookings/orders after profile backfill; seed still applies. Seven actual PostgREST tests validate admin embeddings, count aggregates, usable memberships and dashboard ordering; mapping unit tests also pass. |
| I4 | Verified test-mode checkout must have payment_status=paid. Unpaid/no-payment-required completion grants nothing; async success supported. Recurring Checkout records payment and defers grants to paid invoice. |
| I5 | Actual subscription enum mapping; status events cannot extend paid periods. Event.created watermark + conservative same-second status rank; canceled is terminal. Pre-invoice adverse/canceled status is retained without granting access. |
| I6 | Unique membership source_order_id, existing unique subscription reference, order row lock, event ledger, strictly-newer paid-period reset. Invoice line period is immutable input, never retrieved current subscription period. Separate invoice-period watermark prevents a later-created payment for an older invoice clearing newer delinquency. Exact 8-argument wrapper remains, but new transitions require v2 evidence; see contract rationale below. Checkout success now checks the exact order's membership, not another purchase of the same plan. |
| I7 | Booking records membership period under the same locks as deduction. Cancellation refunds only an exact period match, capped at original credits_total; unknown legacy period never receives cross-period refund. Half-null snapshots rejected. |
| I8 | book_session locks/checks active parent class inside the transaction; pgTAP covers inactive parent rejection. |
| I9 | Query filters active, currently valid, unlimited/positive-credit memberships; earliest expiry then UUID is deterministic. Exhausted-only fallback preserves CREDITS_INSUFFICIENT. Actual PostgREST tests exercise several simultaneous finite/unlimited/exhausted memberships. |
| I10 | Asia/Taipei wall-time conversion for create/edit; explicit UTC instant sent, offset-less server input rejected. Focused conversion/roundtrip/invalid-date tests; studio timezone also applied to admin/member displays and dashboard day boundaries. |
| I11 | DB capacity trigger shares session row serialization with booking, rejects CAPACITY_BELOW_BOOKINGS; action maps safe capacity field error. pgTAP plus a real two-connection capacity/booking race passed. |
| I12 | Required class duration fixture fixed; missing order resolved before event-ledger FK insert. pgTAP uses SET ROLE anon/authenticated and member/admin claims; privilege, ownership, blocked direct mutation, refund and Stripe ordering assertions execute on PostgreSQL. |
| I13 | Scoped/exact E2E selectors; admin selects the intended class and checks Taipei edit roundtrip. Added normal signup and opt-in actual Stripe test Checkout→signed webhook→booking/cancellation→admin readback for Single Class and Starter 8. No fabricated payment success or membership seeding for those registered users. Runtime is explicitly skipped, not passed. |
| I14 | Middleware redirects absent/expired account auth with allowlisted next for all three account paths; account route-boundary guard handles late expiry. Unit tests cover safe next and avoid turning profile outages into login redirects. |
| I15 | Class/member/order/profile query errors become generic DataError or safe retry boundaries; genuine empty/null results stay distinct. No raw DB/provider error is rendered. Focused failing-query tests cover classes, all account lists/dashboard and order status. |

Adjacent fixes: real schedule confirmed counts; earliest future next booking; three Stripe test Price setup instructions; Single Class 30-day/one-time copy; removed fabricated “12 today”; cancellation copy no longer promises a cross-period refund.

### Contract and forward-migration rationale

The eight original RPC parameters cannot carry payment_status, actual subscription status or provider event ordering. Inferring paid/active from event type or server arrival time would recreate I4–I6. Migration 003 therefore preserves the eight-argument signature as a service-only fail-closed wrapper (committed duplicates remain no-ops; missing order remains ORDER_NOT_FOUND; new transitions require STRIPE_EVENT_CONTEXT_REQUIRED) and introduces the eleven-argument v2. Webhook, tests, README, design addendum and implementation plan are updated. Deploy migration before the new caller; old callers safely retry during rollout.

Legacy subscription/order links are backfilled only when provable. Unlinked historical one-time grants are not guessed or automatically deleted; legacy data, if any, requires explicit reconciliation. Unknown historical booking periods fail closed for refunds. Trial/proration/mixed-interval invoices remain outside the paid-only app contract. Same-second conflicting statuses deliberately prefer loss of access over unproved reactivation.

### Executed verification

| Check | Actual result |
| --- | --- |
| `pnpm test` | PASS: 28 files, 154 tests, exit 0. |
| `pnpm lint` | PASS: tsc --noEmit + Biome; 118 files checked, exit 0. |
| `pnpm build` | PASS: production compilation, type checking, page generation; only existing middleware→proxy deprecation warning. |
| `pnpm exec playwright test --list` | PASS: 14 tests in 4 files; no browser launched. |
| `pnpm exec playwright test` | 14 SKIPPED; exact prerequisite: E2E_SEED is not true. Not an E2E pass. |
| Empty app DB migrations + seed | PASS: 001→002→003 then seed on task-owned Supabase PostgreSQL 17.6.1.167 container (Supabase auth schema/roles bootstrap present). No existing user project reset. |
| `psql -At -v ON_ERROR_STOP=1 ... < supabase/tests/booking_invariants.sql` | PASS: 88 `ok`, plan `1..88`, zero `not ok`, transaction rollback and exit 0. pg_prove was absent; parsed TAP count/failures explicitly rather than relying on psql exit alone. |
| `PGTAP_REST_URL=http://127.0.0.1:55434 pnpm exec vitest run --config supabase/tests/postgrest.config.ts` | PASS: 7 tests against final migration schema, PostgREST 16.2 and PostgreSQL. Only auth identity is stubbed here; RLS evidence is from pgTAP above. |
| `node supabase/tests/concurrency.mjs membership-remediation-verified-db-20260915` | PASS: two connections competing for one seat grant one booking; concurrent capacity decrease waits and rejects after the booking commit. |
| `git diff --check` | PASS before commit. |

Tests-first evidence: the new unpaid/live Stripe and class-query error tests initially failed (4 failures); they pass after implementation. PostgreSQL initially reproduced the missing-order FK error and anon/authenticated execution grant issue. The final DB tests also exercise status-before-invoice, late old-period invoice payments, cross-period refunds and order uniqueness.

Environment-limited: Supabase CLI and Stripe CLI are absent from PATH; NEXT_PUBLIC_SUPABASE_URL/ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, E2E_SEED and E2E_STRIPE were unset. The standalone DB/PostgREST checks do not run Supabase Auth HTTP, browser registration, hosted Stripe Checkout, real signature forwarding or manual responsive/keyboard acceptance. No Stripe account was contacted and no payment was created. These remain runtime validation requirements, not claimed successes. All task-owned DB/PostgREST containers were stopped after checks; their disposable data is retained, not deleted. No parent repository files or unrelated untracked files were staged.

### Exact remediation paths (58 files)

```text
.env.example
README.md
docs/superpowers/plans/2026-09-15-membership-booking-demo.md
docs/superpowers/specs/2026-09-15-membership-booking-demo-design.md
e2e/admin-operations.spec.ts
e2e/fixtures.ts
e2e/member-booking.spec.ts
e2e/negative-paths.spec.ts
e2e/registration-payment.spec.ts
src/app/(member)/account/bookings/page.tsx
src/app/(member)/account/layout.tsx
src/app/(member)/account/orders/page.tsx
src/app/(member)/account/page.tsx
src/app/(member)/account/pages.test.tsx
src/app/(member)/error.tsx
src/app/api/stripe/webhook/route.test.ts
src/app/page.tsx
src/features/admin/actions.test.ts
src/features/admin/actions.ts
src/features/admin/components/booking-table.tsx
src/features/admin/components/member-table.tsx
src/features/admin/components/order-table.tsx
src/features/admin/components/session-form.tsx
src/features/admin/components/session-table.tsx
src/features/admin/queries.test.ts
src/features/admin/queries.ts
src/features/bookings/actions.ts
src/features/bookings/queries.test.ts
src/features/bookings/queries.ts
src/features/classes/queries.test.ts
src/features/classes/queries.ts
src/features/member/components/booking-list.tsx
src/features/member/components/member-summary-card.tsx
src/features/orders/queries.test.ts
src/features/orders/queries.ts
src/features/plans/components/plan-card.test.tsx
src/features/plans/components/plan-card.tsx
src/lib/auth/account.test.ts
src/lib/auth/account.ts
src/lib/auth/guards.test.ts
src/lib/auth/guards.ts
src/lib/errors/data.ts
src/lib/stripe/checkout.test.ts
src/lib/stripe/checkout.ts
src/lib/stripe/events.test.ts
src/lib/stripe/events.ts
src/lib/stripe/server.ts
src/lib/time/studio.test.ts
src/lib/time/studio.ts
src/middleware.test.ts
src/middleware.ts
supabase/migrations/202609150003_final_integrity_hardening.sql
supabase/tests/booking_invariants.sql
supabase/tests/concurrency.mjs
supabase/tests/postgrest.config.ts
supabase/tests/postgrest.test.ts
supabase/tests/query_memberships.sql
.superpowers/sdd/2026-09-15-membership-booking-demo/task-8-report.md
```

### Scoped final re-review

An independent scoped re-review of `d172596..b45db47` verified all 15 prior Critical/Important findings as addressed and found no new production Critical/Important breakage. It found one Important test-harness issue: `supabase/tests/query_memberships.sql` is discovered by standard `supabase test db` but depends on fixtures rolled back by `booking_invariants.sql`; it is parked for a later harness cleanup after the single permitted final fix wave.
