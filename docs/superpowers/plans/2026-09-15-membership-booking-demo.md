# Membership Booking Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立一個可部署的全端皮拉提斯／瑜伽工作室會員預約系統，完成 Stripe test mode 付款、會員額度、課程預約與管理後台。

**Architecture:** Next.js App Router 負責公開頁、會員頁、管理後台與 server mutations；Supabase Auth／PostgreSQL／RLS 負責身份、資料與權限；Stripe Checkout 與 webhook 負責月訂閱及一次性付款。預約容量與額度透過 PostgreSQL transaction、`SELECT ... FOR UPDATE` 與 unique index 保護。

**Tech Stack:** Next.js App Router、TypeScript、pnpm、shadcn/ui、Tailwind CSS、Supabase SSR/Auth/PostgreSQL、Stripe test mode、Zod、Vitest、Testing Library、Playwright、Biome。

**Spec:** `docs/superpowers/specs/2026-09-15-membership-booking-demo-design.md`

## Global Constraints

- 使用 `pnpm`，不使用 npm 或 Bun。
- 使用 Next.js App Router 與 TypeScript；所有 server mutation 只從 server action 或 route handler 進入。
- UI primitive 使用 shadcn/ui；產品元件放在 feature／shared boundary，不把業務邏輯塞進 generated primitive。
- Stripe 只使用 test mode；付款成功以驗證過的 webhook 為準，前端返回頁不得自行授予會員資格。
- Supabase service-role key 只能在 server-side webhook 與明確的管理操作使用，不得進入 browser bundle。
- 方案價格從 PostgreSQL 讀取；booking 使用 transaction、`SELECT ... FOR UPDATE` 與 `WHERE status = 'confirmed'` partial unique index。
- 8 堂月訂閱每個 Stripe billing period 重置 8 堂；無限方案不扣額度；單堂體驗付款後建立 30 天有效的 1 堂額度。
- 使用 Quiet modern 視覺：霧灰綠、白、深墨色；公開首頁優先轉換，登入後優先會員操作；前台手機優先，後台桌面優先。
- 不提交 production secret、Stripe webhook payload、卡號、完整 token 或會員個資；`.env.example` 只放變數名稱與用途。
- 第一版不包含真金流、多店、教練抽成、優惠券、發票、退款自動化、正式 email／SMS 與 OAuth。

---

### Task 1: 建立 Next.js、shadcn/ui 與測試基礎

**Files:**
- Create: `package.json`
- Create: `pnpm-lock.yaml`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `postcss.config.mjs`
- Create: `biome.json`
- Create: `components.json`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `.env.example`
- Create: `.gitignore`
- Create: `src/app/layout.tsx`
- Create: `src/app/globals.css`
- Create: `src/app/page.tsx`
- Create: `src/test/setup.ts`
- Create: `src/app/page.test.tsx`

**Interfaces:**
- Produces `pnpm dev`, `pnpm lint`, `pnpm test`, `pnpm build` and `pnpm e2e` scripts for every later task.
- Produces the `@/*` TypeScript alias and shadcn/ui CSS variable tokens consumed by all feature components.
- Produces `src/test/setup.ts` importing `@testing-library/jest-dom` for component assertions.

- [ ] **Step 1: Scaffold the project with the approved dependency boundary**

  Run from `.projects/personal/membership-booking-demo`:

  ```bash
  pnpm init
  pnpm add next@latest react@latest react-dom@latest @supabase/ssr @supabase/supabase-js stripe zod clsx tailwind-merge class-variance-authority lucide-react date-fns
  pnpm add -D typescript @types/node @types/react @types/react-dom @biomejs/biome vitest jsdom @testing-library/jest-dom @testing-library/react @testing-library/user-event @playwright/test
  pnpm dlx shadcn@latest init --base-color neutral --css-variables --yes
  pnpm exec playwright install chromium
  ```

  Configure scripts exactly as follows:

  ```json
  {
    "scripts": {
      "dev": "next dev",
      "build": "next build",
      "start": "next start",
      "lint": "tsc --noEmit && biome check src/",
      "format": "biome format --write src/",
      "test": "vitest run",
      "test:watch": "vitest",
      "e2e": "playwright test"
    }
  }
  ```

- [ ] **Step 2: Configure TypeScript, Biome, Vitest, Playwright and environment names**

  Set the `@/*` alias to `./src/*`, Vitest environment to `jsdom`, and Playwright base URL to `http://127.0.0.1:3000`. Add these exact environment names to `.env.example` with empty values:

  ```dotenv
  NEXT_PUBLIC_SUPABASE_URL=
  NEXT_PUBLIC_SUPABASE_ANON_KEY=
  SUPABASE_SERVICE_ROLE_KEY=
  STRIPE_SECRET_KEY=
  STRIPE_WEBHOOK_SECRET=
  NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000
  ```

  Add `.env*` to `.gitignore` while keeping `.env.example` tracked. Set Biome to 2-space indentation, double quotes, semicolons, and `src/` as the checked directory.

- [ ] **Step 3: Create the application shell and a failing render test**

  Create `src/test/setup.ts` and write the first test before finalizing the page:

  ```tsx
  import { render, screen } from "@testing-library/react";
  import HomePage from "./page";

  test("renders the Motion Room booking call to action", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { name: /make space for movement/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /book a class/i })).toHaveAttribute("href", "/classes");
  });
  ```

- [ ] **Step 4: Run the focused test and confirm the shell is not complete yet**

  Run `pnpm test -- src/app/page.test.tsx`.

  Expected: FAIL because `src/app/page.tsx` does not yet contain the Motion Room heading and booking link.

- [ ] **Step 5: Implement the minimal shell and visual tokens**

  Add a valid root layout, a minimal Motion Room homepage shell, and CSS variables for the approved palette:

  ```css
  :root {
    --background: 150 18% 97%;
    --foreground: 160 28% 13%;
    --primary: 158 32% 28%;
    --primary-foreground: 0 0% 100%;
    --muted: 150 17% 92%;
    --muted-foreground: 155 12% 42%;
    --accent: 145 24% 83%;
    --border: 150 15% 86%;
    --radius: 0.75rem;
  }
  ```

  Use a semantic `<main>`, a single `<h1>`, and a `Link` to `/classes`; do not add business state in this task.

- [ ] **Step 6: Run the setup verification**

  Run `pnpm test -- src/app/page.test.tsx`, `pnpm lint`, and `pnpm build`.

  Expected: the focused test passes, TypeScript and Biome pass, and Next.js produces a production build.

- [ ] **Step 7: Commit the setup deliverable**

  ```bash
  git add -- package.json pnpm-lock.yaml tsconfig.json next.config.ts postcss.config.mjs biome.json components.json vitest.config.ts playwright.config.ts .env.example .gitignore src/app/layout.tsx src/app/globals.css src/app/page.tsx src/test/setup.ts src/app/page.test.tsx
  git commit --only -m "chore: scaffold membership booking app" -- package.json pnpm-lock.yaml tsconfig.json next.config.ts postcss.config.mjs biome.json components.json vitest.config.ts playwright.config.ts .env.example .gitignore src/app/layout.tsx src/app/globals.css src/app/page.tsx src/test/setup.ts src/app/page.test.tsx
  ```

---

### Task 2: 建立 Supabase schema、RLS、seed 與原子預約資料庫函式

**Files:**
- Create: `supabase/config.toml`
- Create: `supabase/migrations/202609150001_initial_schema.sql`
- Create: `supabase/seed.sql`
- Create: `supabase/tests/booking_invariants.sql`
- Create: `src/lib/domain/types.ts`
- Create: `src/lib/domain/types.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces `Database`-compatible domain types: `Plan`, `Membership`, `ClassSession`, `Booking`, `Order`, and `OrderStatus`.
- Produces PostgreSQL RPC `public.book_session(p_session_id uuid, p_membership_id uuid)` returning `{ booking_id uuid, credits_remaining integer }` where `credits_remaining` is nullable for unlimited plans.
- Produces PostgreSQL RPC `public.cancel_booking(p_booking_id uuid)` returning `{ booking_id uuid, credits_remaining integer }`.
- Produces `public.has_role(required_role text)` for RLS policies without recursive `profiles` policy queries.
- Produces PostgreSQL RPC `public.apply_stripe_event(p_provider_event_id text, p_event_type text, p_order_id uuid, p_customer_id text, p_subscription_id text, p_period_start timestamptz, p_period_end timestamptz, p_payment_reference text)`; event insertion and the order／membership／payment transition occur in one transaction.

- [ ] **Step 1: Write the database invariant test before the migration**

  Create `supabase/tests/booking_invariants.sql` with pgTAP assertions for the approved rules:

  ```sql
  select plan(4);
  select has_table('public', 'profiles', 'profiles exists');
  select has_table('public', 'class_sessions', 'class_sessions exists');
  select has_table('public', 'bookings', 'bookings exists');
  select has_function('public', 'book_session', array['uuid', 'uuid'], 'atomic booking RPC exists');
  select * from finish();
  ```

- [ ] **Step 2: Run the database test and verify it fails for the empty database**

  Run `supabase start` followed by `supabase test db`.

  Expected: FAIL because the schema and RPC do not exist yet.

- [ ] **Step 3: Write the initial migration with explicit enums, constraints and indexes**

  Create the tables in dependency order: `profiles`, `plans`, `memberships`, `classes`, `class_sessions`, `orders`, `order_items`, `payments`, `stripe_events`, `bookings`. Use UUID primary keys, `timestamptz` timestamps, TWD integer amounts, and these status values:

  ```sql
  create type public.app_role as enum ('member', 'admin');
  create type public.membership_status as enum ('active', 'past_due', 'canceled', 'expired');
  create type public.booking_status as enum ('confirmed', 'cancelled');
  create type public.order_status as enum ('pending', 'paid', 'failed', 'cancelled', 'refunded');
  create type public.billing_type as enum ('subscription', 'one_time');

  create unique index bookings_one_active_per_user
    on public.bookings (user_id, session_id)
    where status = 'confirmed';

  create unique index stripe_events_provider_id
    on public.stripe_events (provider_event_id);
  ```

  Add checks for non-negative `amount_twd_cents`, positive session capacity, `credits_remaining <= credits_total` when credits are finite, and `ends_at > starts_at`. Store `order_items.unit_amount_twd_cents` as the paid-price snapshot.

- [ ] **Step 4: Add `has_role`, `book_session`, `cancel_booking` and Stripe event transaction functions**

  The booking function must lock the selected session before counting confirmed bookings and updating membership credits:

  ```sql
  select * into locked_session
    from public.class_sessions
   where id = p_session_id and active = true
   for update;

  if (select count(*) from public.bookings
      where session_id = p_session_id and status = 'confirmed') >= locked_session.capacity then
    raise exception using errcode = 'P0001', message = 'SESSION_FULL';
  end if;
  ```

  Check `auth.uid() = membership.user_id`, active membership status, session start time, duplicate confirmed booking, and finite credits before insertion. Decrement credits and insert the booking in the same transaction. `cancel_booking` must check ownership or `has_role('admin')`, reject started/cancelled bookings, set `cancelled_at`, and return one credit in the same transaction for finite plans.

  Add `public.apply_stripe_event` with the exact signature from this task’s interface. It must insert `p_provider_event_id` into `stripe_events` first, return without mutation when the ID already exists, and otherwise update the referenced order／membership／payment rows according to `p_event_type`. The insert and every state change must be inside the same PostgreSQL function transaction; a raised error must roll back the event ledger row.

- [ ] **Step 5: Add RLS policies and seed data**

  Enable RLS on every application table. Public users may select only active plans, classes and future active sessions. Members may select their own profiles, memberships, bookings, orders and payments; members may invoke the booking RPC but may not insert bookings directly. Admin policies use `has_role('admin')` for full operational reads and writes. Webhook writes use the server service-role client.

  Seed three plans and deterministic demo content:

  ```sql
  insert into public.plans (code, name, billing_type, class_credits, amount_twd_cents, active)
  values
    ('starter-monthly', 'Starter 8', 'subscription', 8, 288000, true),
    ('unlimited-monthly', 'Unlimited', 'subscription', null, 468000, true),
    ('single-class', 'Single Class', 'one_time', 1, 68000, true);
  ```

  Add at least six classes and twelve future sessions with capacities 8–12. Keep Stripe Price IDs configurable in the seed comments or environment-specific SQL; do not place real credentials in the file.

- [ ] **Step 6: Add domain types and test the credit semantics**

  Define the shared types and test that the three approved plan shapes are representable. Monetary values use the smallest TWD unit so Stripe and database snapshots share one exact integer representation:

  ```ts
  export type Plan = {
    id: string;
    code: "starter-monthly" | "unlimited-monthly" | "single-class";
    billingType: "subscription" | "one_time";
    classCredits: number | null;
    amountTwdCents: number;
  };

  export type Membership = {
    id: string;
    userId: string;
    status: "active" | "past_due" | "canceled" | "expired";
    creditsRemaining: number | null;
    currentPeriodEnd: string;
  };
  ```

- [ ] **Step 7: Run the database and type verification**

  Run `supabase db reset`, `supabase test db`, `pnpm test -- src/lib/domain/types.test.ts`, and `pnpm lint`.

  Expected: migration applies from an empty database, pgTAP passes, domain type tests pass, and no TypeScript／Biome error remains.

- [ ] **Step 8: Commit the database deliverable**

  ```bash
  git add -- supabase/config.toml supabase/migrations/202609150001_initial_schema.sql supabase/seed.sql supabase/tests/booking_invariants.sql src/lib/domain/types.ts src/lib/domain/types.test.ts .env.example
  git commit --only -m "feat: add membership booking database schema" -- supabase/config.toml supabase/migrations/202609150001_initial_schema.sql supabase/seed.sql supabase/tests/booking_invariants.sql src/lib/domain/types.ts src/lib/domain/types.test.ts .env.example
  ```

---

### Task 3: 建立 Supabase SSR auth、session refresh 與角色 guard

**Files:**
- Create: `src/lib/supabase/browser.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/admin.ts`
- Create: `src/lib/auth/types.ts`
- Create: `src/lib/auth/guards.ts`
- Create: `src/lib/auth/guards.test.ts`
- Create: `src/middleware.ts`
- Create: `src/app/(auth)/login/actions.ts`
- Create: `src/app/(auth)/signup/actions.ts`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Produces `createBrowserClient(): BrowserSupabaseClient` for client components.
- Produces `createServerClient(): Promise<ServerSupabaseClient>` with cookie read／write support.
- Produces `createAdminClient(): AdminSupabaseClient` for server-only webhook／admin operations.
- Produces `getCurrentUser(client?): Promise<SessionUser | null>`, `requireUser(client?): Promise<SessionUser>`, and `requireAdmin(client?): Promise<SessionUser>`.
- `SessionUser` is `{ id: string; email: string | null; role: "member" | "admin" }`. The three session functions accept an optional `ServerSupabaseClient` for tests and create one internally when omitted.

- [ ] **Step 1: Write guard tests for member, admin and unauthenticated paths**

  Cover the exact contract:

  ```ts
  await expect(requireUser(mockUnauthenticatedClient)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  await expect(requireAdmin(mockMemberClient)).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(requireAdmin(mockAdminClient)).resolves.toMatchObject({ role: "admin" });
  ```

- [ ] **Step 2: Run the guard tests and confirm missing auth code fails**

  Run `pnpm test -- src/lib/auth/guards.test.ts`.

  Expected: FAIL because the Supabase clients and guard functions are not defined.

- [ ] **Step 3: Implement SSR clients and auth guards**

  Use `@supabase/ssr` to create browser／server clients. `createAdminClient` must throw a `CONFIGURATION_ERROR` when `SUPABASE_SERVICE_ROLE_KEY` is absent and must be imported only by server files. `requireAdmin` must load the profile role through the authenticated server client; it must not trust a role sent by the browser.

- [ ] **Step 4: Implement session refresh middleware**

  Refresh Supabase cookies for application routes while excluding `_next/static`, `_next/image`, favicon, and `/api/stripe/webhook`. Do not redirect public pages, `/login`, `/signup`, `/checkout/cancel`, or `/checkout/success` from middleware; protected layouts and server actions call `requireUser`／`requireAdmin`.

- [ ] **Step 5: Add auth action validation**

  Create `login` and `signup` server actions that validate email/password with Zod, call Supabase Auth, return typed field errors, and use `redirect("/account")` only after a successful authenticated session. Never return raw Supabase errors or tokens to the client.

- [ ] **Step 6: Run tests and verify the auth boundary**

  Run `pnpm test -- src/lib/auth/guards.test.ts`, `pnpm lint`, and `pnpm build`.

  Expected: guard tests pass, protected server imports typecheck, and the build succeeds without exposing the service-role key to a client bundle.

- [ ] **Step 7: Commit the auth deliverable**

  ```bash
  git add -- src/lib/supabase/browser.ts src/lib/supabase/server.ts src/lib/supabase/admin.ts src/lib/auth/types.ts src/lib/auth/guards.ts src/lib/auth/guards.test.ts src/middleware.ts src/app/'(auth)'/login/actions.ts src/app/'(auth)'/signup/actions.ts src/app/layout.tsx
  git commit --only -m "feat: add supabase auth and role guards" -- src/lib/supabase/browser.ts src/lib/supabase/server.ts src/lib/supabase/admin.ts src/lib/auth/types.ts src/lib/auth/guards.ts src/lib/auth/guards.test.ts src/middleware.ts src/app/'(auth)'/login/actions.ts src/app/'(auth)'/signup/actions.ts src/app/layout.tsx
  ```

---

### Task 4: 實作方案訂單、Stripe Checkout 與 webhook 狀態同步

**Files:**
- Create: `src/lib/stripe/server.ts`
- Create: `src/lib/stripe/checkout.ts`
- Create: `src/lib/stripe/checkout.test.ts`
- Create: `src/lib/stripe/events.ts`
- Create: `src/lib/stripe/events.test.ts`
- Create: `src/features/orders/types.ts`
- Create: `src/features/orders/queries.ts`
- Create: `src/features/orders/actions.ts`
- Create: `src/features/orders/actions.test.ts`
- Create: `src/app/api/stripe/webhook/route.ts`
- Create: `src/app/checkout/success/page.tsx`
- Create: `src/app/checkout/cancel/page.tsx`
- Modify: `src/lib/domain/types.ts`

**Interfaces:**
- `startCheckout(input: { planId: string }): Promise<CheckoutActionResult>` returns `{ ok: true, orderId: string, checkoutUrl: string }` or `{ ok: false, code: "INVALID_PLAN" | "CONFIGURATION_ERROR", message: string }`.
- `buildCheckoutSessionParams(input: BuildCheckoutSessionInput): Stripe.Checkout.SessionCreateParams` selects `mode=subscription` or `mode=payment` from the database plan; a separate server-only caller sends these params to Stripe.
- `processStripeEvent(event: Stripe.Event): Promise<void>` is idempotent and performs all order／membership writes through the admin client.
- `getOrderStatus(orderId: string): Promise<OrderStatusView>` returns pending／paid／failed／cancelled status and membership activation state.

- [ ] **Step 1: Write failing checkout builder tests**

  Test that the plan billing type controls Stripe mode and that the server refuses a client-supplied amount:

  ```ts
  const params = buildCheckoutSessionParams({
    orderId: "order-1",
    plan: { id: "plan-1", stripePriceId: "price_123", billingType: "subscription" },
    customerEmail: "member@example.com",
  });

  expect(params.mode).toBe("subscription");
  expect(params.line_items?.[0]?.price).toBe("price_123");
  ```

  Add the same assertion for `billingType: "one_time"` and a rejection when `stripePriceId` is empty.

- [ ] **Step 2: Run focused Stripe tests and verify they fail**

  Run `pnpm test -- src/lib/stripe/checkout.test.ts`.

  Expected: FAIL because the Stripe client and Checkout builder are not implemented.

- [ ] **Step 3: Implement the server-only Stripe client and Checkout builder**

  Create the Stripe client from `STRIPE_SECRET_KEY` and use the DB plan’s `stripe_price_id`, `amount_twd_cents`, `billing_type`, and `class_credits`. Persist a `pending` order before creating the Checkout Session. Put only the internal `orderId` in Stripe metadata; use the database as the order source of truth.

- [ ] **Step 4: Write failing webhook tests for success, renewal, failure and duplicate event**

  Test `processStripeEvent` with fixtures for `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`, plus the same event ID twice. Assert that the second call makes no additional order／membership／credit mutation.

- [ ] **Step 5: Implement idempotent webhook event processing**

  In `src/app/api/stripe/webhook/route.ts`, read the raw request body, verify `stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET)`, return 400 for invalid signatures, and call `processStripeEvent`. `processStripeEvent` extracts only normalized fields from the verified event and calls `public.apply_stripe_event`; the RPC inserts `provider_event_id` and applies the state transition in the same database transaction. A unique conflict for an already committed event returns 200 with no-op behavior, while a failed transition rolls back the event row so Stripe can retry. Do not persist the raw webhook payload.

  Implement these exact transitions:

  - `checkout.session.completed`: mark order `paid`; create membership with 8, 1, or null credits; attach Stripe customer／subscription references.
  - `invoice.paid`: move the subscription membership to `active`, set the new period, and reset finite credits to 8.
  - `invoice.payment_failed`: set membership `past_due` and leave the order history intact.
  - `customer.subscription.deleted`: set membership `canceled` with its last valid period preserved.

- [ ] **Step 6: Implement order status pages and checkout action tests**

  `startCheckout` must call `requireUser`, re-read the plan, create the pending order, and return the hosted URL. Success page must poll `getOrderStatus` for a bounded period and show `processing` until webhook data arrives; it must never call an activation mutation. Cancel page must link back to `/plans`.

- [ ] **Step 7: Run payment verification**

  Run `pnpm test -- src/lib/stripe/checkout.test.ts src/lib/stripe/events.test.ts src/features/orders/actions.test.ts`, `pnpm lint`, and `pnpm build`.

  Start local forwarding with `stripe listen --forward-to http://127.0.0.1:3000/api/stripe/webhook`; complete one subscription and one one-time Checkout using Stripe test card `4242 4242 4242 4242`. Verify `orders`, `payments`, `stripe_events`, and `memberships` in Supabase rather than relying only on the browser.

- [ ] **Step 8: Commit the payment deliverable**

  ```bash
  git add -- src/lib/stripe/server.ts src/lib/stripe/checkout.ts src/lib/stripe/checkout.test.ts src/lib/stripe/events.ts src/lib/stripe/events.test.ts src/features/orders/types.ts src/features/orders/queries.ts src/features/orders/actions.ts src/features/orders/actions.test.ts src/app/api/stripe/webhook/route.ts src/app/checkout/success/page.tsx src/app/checkout/cancel/page.tsx src/lib/domain/types.ts
  git commit --only -m "feat: add stripe checkout and webhook sync" -- src/lib/stripe/server.ts src/lib/stripe/checkout.ts src/lib/stripe/checkout.test.ts src/lib/stripe/events.ts src/lib/stripe/events.test.ts src/features/orders/types.ts src/features/orders/queries.ts src/features/orders/actions.ts src/features/orders/actions.test.ts src/app/api/stripe/webhook/route.ts src/app/checkout/success/page.tsx src/app/checkout/cancel/page.tsx src/lib/domain/types.ts
  ```

---

### Task 5: 實作課程查詢、原子預約與取消流程

**Files:**
- Create: `src/features/classes/types.ts`
- Create: `src/features/classes/queries.ts`
- Create: `src/features/classes/queries.test.ts`
- Create: `src/features/bookings/types.ts`
- Create: `src/features/bookings/queries.ts`
- Create: `src/features/bookings/actions.ts`
- Create: `src/features/bookings/actions.test.ts`
- Create: `src/features/bookings/domain.ts`
- Create: `src/features/bookings/domain.test.ts`
- Create: `src/app/(member)/account/bookings/actions.ts`
- Modify: `src/lib/domain/types.ts`
- Modify: `supabase/migrations/202609150001_initial_schema.sql`

**Interfaces:**
- `listUpcomingSessions(filters: SessionFilters): Promise<ClassSession[]>` returns only active future sessions with confirmed booking count and remaining spots.
- `getSessionDetails(sessionId: string): Promise<ClassSessionDetails | null>` returns class, instructor, start／end time, capacity and remaining spots.
- `BookingResult = { ok: true; bookingId: string; creditsRemaining: number | null } | { ok: false; code: "UNAUTHORIZED" | "MEMBERSHIP_INACTIVE" | "SESSION_FULL" | "DUPLICATE_BOOKING" | "CREDITS_INSUFFICIENT" | "SESSION_STARTED"; message: string }`.
- `createBooking(input: { sessionId: string }): Promise<BookingResult>` resolves the current user and active membership, then calls `book_session`.
- `cancelBooking(input: { bookingId: string }): Promise<CancelBookingResult>` calls `cancel_booking` and returns the restored credit count.

- [ ] **Step 1: Write domain tests for every booking decision**

  Keep pure eligibility rules independent of Supabase:

  ```ts
  expect(canBookSession({ status: "active", startsAt: future, remainingSpots: 1, creditsRemaining: 1 })).toEqual({ ok: true });
  expect(canBookSession({ status: "active", startsAt: future, remainingSpots: 0, creditsRemaining: 1 })).toMatchObject({ ok: false, code: "SESSION_FULL" });
  expect(canBookSession({ status: "active", startsAt: future, remainingSpots: 1, creditsRemaining: 0 })).toMatchObject({ ok: false, code: "CREDITS_INSUFFICIENT" });
  expect(canBookSession({ status: "expired", startsAt: future, remainingSpots: 1, creditsRemaining: 1 })).toMatchObject({ ok: false, code: "MEMBERSHIP_INACTIVE" });
  ```

  Add cases for a started session, null credits for unlimited plans, and a zero remaining spot.

- [ ] **Step 2: Run domain tests and confirm the booking rules fail before implementation**

  Run `pnpm test -- src/features/bookings/domain.test.ts`.

  Expected: FAIL because `canBookSession` and the typed failure codes do not exist.

- [ ] **Step 3: Implement pure booking eligibility and typed action results**

  Create `canBookSession(input)` with the exact precedence: inactive membership, started session, full session, finite credits exhausted, then success. Use `number | null` for credits so an unlimited plan cannot accidentally become zero. Map database RPC error messages to the same `BookingResult` codes without exposing SQL text.

- [ ] **Step 4: Implement session queries and server actions**

  `listUpcomingSessions` must calculate confirmed count from `bookings` and derive `remainingSpots = max(capacity - confirmedCount, 0)`. `createBooking` must call `requireUser`, load the active membership, call the authenticated Supabase RPC with `sessionId` and membership ID, then invalidate the member dashboard cache. `cancelBooking` must call `requireUser`, invoke the cancellation RPC, and revalidate `/account` and `/account/bookings`.

- [ ] **Step 5: Add integration tests for transaction error mapping**

  Mock the Supabase RPC boundary and assert that `SESSION_FULL`, `DUPLICATE_BOOKING`, `CREDITS_INSUFFICIENT`, and `SESSION_STARTED` become stable user-facing result codes. Add one test proving an RPC failure does not return `{ ok: true }` or mutate client state.

- [ ] **Step 6: Run booking verification**

  Run `pnpm test -- src/features/bookings/domain.test.ts src/features/bookings/queries.test.ts src/features/bookings/actions.test.ts`, `supabase test db`, `pnpm lint`, and `pnpm build`.

  Expected: pure rules, RPC mapping, schema invariants, TypeScript and production build all pass.

- [ ] **Step 7: Commit the booking deliverable**

  ```bash
  git add -- src/features/classes/types.ts src/features/classes/queries.ts src/features/classes/queries.test.ts src/features/bookings/types.ts src/features/bookings/queries.ts src/features/bookings/actions.ts src/features/bookings/actions.test.ts src/features/bookings/domain.ts src/features/bookings/domain.test.ts src/app/'(member)'/account/bookings/actions.ts src/lib/domain/types.ts supabase/migrations/202609150001_initial_schema.sql
  git commit --only -m "feat: add atomic class booking flow" -- src/features/classes/types.ts src/features/classes/queries.ts src/features/classes/queries.test.ts src/features/bookings/types.ts src/features/bookings/queries.ts src/features/bookings/actions.ts src/features/bookings/actions.test.ts src/features/bookings/domain.ts src/features/bookings/domain.test.ts src/app/'(member)'/account/bookings/actions.ts src/lib/domain/types.ts supabase/migrations/202609150001_initial_schema.sql
  ```

---

### Task 6: 建立公開前台、認證頁與會員 dashboard

**Files:**
- Create: `src/components/layout/site-header.tsx`
- Create: `src/components/layout/site-footer.tsx`
- Create: `src/components/shared/section-heading.tsx`
- Create: `src/features/classes/components/class-card.tsx`
- Create: `src/features/classes/components/class-filters.tsx`
- Create: `src/features/plans/components/plan-card.tsx`
- Create: `src/features/plans/components/plan-grid.tsx`
- Create: `src/features/member/components/member-summary-card.tsx`
- Create: `src/features/member/components/booking-list.tsx`
- Create: `src/features/member/components/order-list.tsx`
- Create: `src/app/(marketing)/layout.tsx`
- Create: `src/app/(marketing)/page.tsx`
- Create: `src/app/(marketing)/classes/page.tsx`
- Create: `src/app/(marketing)/classes/[classId]/page.tsx`
- Create: `src/app/(marketing)/plans/page.tsx`
- Create: `src/app/(auth)/login/page.tsx`
- Create: `src/app/(auth)/signup/page.tsx`
- Create: `src/app/(member)/account/layout.tsx`
- Create: `src/app/(member)/account/page.tsx`
- Create: `src/app/(member)/account/bookings/page.tsx`
- Create: `src/app/(member)/account/orders/page.tsx`
- Create: `src/features/classes/components/class-card.test.tsx`
- Create: `src/features/plans/components/plan-card.test.tsx`
- Create: `src/features/member/components/member-summary-card.test.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- `ClassCard` consumes `ClassSession` and emits a link to `/classes/[classId]`.
- `PlanCard` consumes `Plan` and calls `startCheckout({ planId })` after login guard／error rendering.
- `MemberSummaryCard` consumes `MemberDashboardData` with `membership`, `nextBooking`, and `recentOrders`.
- Member layout calls `requireUser`; public layout never calls `requireUser`.

- [ ] **Step 1: Write component tests for the visible conversion and member states**

  Test that `PlanCard` displays `NT$2,880／月` for the starter plan and `ClassCard` displays remaining spots. Test `MemberSummaryCard` displays `5 堂剩餘` for a finite membership and `不限堂數` for null credits.

- [ ] **Step 2: Run component tests and confirm missing UI fails**

  Run `pnpm test -- src/features/classes/components/class-card.test.tsx src/features/plans/components/plan-card.test.tsx src/features/member/components/member-summary-card.test.tsx`.

  Expected: FAIL because the feature components and pages do not exist.

- [ ] **Step 3: Add the shadcn/ui primitives used by the frontend**

  Run:

  ```bash
  pnpm dlx shadcn@latest add button card badge calendar checkbox dialog dropdown-menu form input label separator sheet skeleton table tabs toast tooltip
  ```

  Keep all generated files under `src/components/ui/`; use `cn()` for conditional classes and keep business rules out of these files.

- [ ] **Step 4: Implement the public marketing and class browsing pages**

  Build the Conversion-first homepage with one H1, `/classes` CTA, a “Today’s openings” section, three plan highlights, and a trust／studio section. Build `/classes` with date, category and level filters using URL search params so a shared URL reproduces the view. Use server queries for sessions and show `loading.tsx`, `error.tsx`, empty-state, and full-state cards.

- [ ] **Step 5: Implement plan selection and auth pages**

  Build `/plans` with the three seeded plans, billing labels, credit summaries, and accessible primary buttons. Unauthenticated checkout attempts link to `/login?next=/plans`; authenticated attempts call `startCheckout`. Login and signup pages use the Task 3 actions and preserve safe `next` values that begin with `/`.

- [ ] **Step 6: Implement member-first dashboard and account pages**

  Protect `/account` with `requireUser`. Show next confirmed booking, membership period／status, remaining credits, quick “Book a class” action, upcoming bookings, and recent orders. Add `/account/bookings` with cancel confirmation through shadcn Dialog and `/account/orders` with status badges. Use server-rendered initial data and client components only for filters, dialogs, and form pending states.

- [ ] **Step 7: Run component and route verification**

  Run the three focused component tests, `pnpm lint`, `pnpm build`, and `pnpm dev`. Manually verify public／member navigation at 375px and 1440px widths, keyboard focus on primary actions, and the success／cancel checkout states.

- [ ] **Step 8: Commit the frontend deliverable**

  ```bash
  git add -- src/components/layout/site-header.tsx src/components/layout/site-footer.tsx src/components/shared/section-heading.tsx src/features/classes/components/class-card.tsx src/features/classes/components/class-filters.tsx src/features/plans/components/plan-card.tsx src/features/plans/components/plan-grid.tsx src/features/member/components/member-summary-card.tsx src/features/member/components/booking-list.tsx src/features/member/components/order-list.tsx src/app/'(marketing)'/layout.tsx src/app/'(marketing)'/page.tsx src/app/'(marketing)'/classes/page.tsx src/app/'(marketing)'/classes/'[classId]'/page.tsx src/app/'(marketing)'/plans/page.tsx src/app/'(auth)'/login/page.tsx src/app/'(auth)'/signup/page.tsx src/app/'(member)'/account/layout.tsx src/app/'(member)'/account/page.tsx src/app/'(member)'/account/bookings/page.tsx src/app/'(member)'/account/orders/page.tsx src/features/classes/components/class-card.test.tsx src/features/plans/components/plan-card.test.tsx src/features/member/components/member-summary-card.test.tsx src/app/page.tsx src/app/globals.css src/components/ui
  git commit --only -m "feat: add member booking frontend" -- src/components/layout/site-header.tsx src/components/layout/site-footer.tsx src/components/shared/section-heading.tsx src/features/classes/components/class-card.tsx src/features/classes/components/class-filters.tsx src/features/plans/components/plan-card.tsx src/features/plans/components/plan-grid.tsx src/features/member/components/member-summary-card.tsx src/features/member/components/booking-list.tsx src/features/member/components/order-list.tsx src/app/'(marketing)'/layout.tsx src/app/'(marketing)'/page.tsx src/app/'(marketing)'/classes/page.tsx src/app/'(marketing)'/classes/'[classId]'/page.tsx src/app/'(marketing)'/plans/page.tsx src/app/'(auth)'/login/page.tsx src/app/'(auth)'/signup/page.tsx src/app/'(member)'/account/layout.tsx src/app/'(member)'/account/page.tsx src/app/'(member)'/account/bookings/page.tsx src/app/'(member)'/account/orders/page.tsx src/features/classes/components/class-card.test.tsx src/features/plans/components/plan-card.test.tsx src/features/member/components/member-summary-card.test.tsx src/app/page.tsx src/app/globals.css src/components/ui
  ```

---

### Task 7: 建立管理後台與 admin CRUD 權限邊界

**Files:**
- Create: `src/features/admin/types.ts`
- Create: `src/features/admin/queries.ts`
- Create: `src/features/admin/actions.ts`
- Create: `src/features/admin/actions.test.ts`
- Create: `src/features/admin/components/admin-sidebar.tsx`
- Create: `src/features/admin/components/metric-card.tsx`
- Create: `src/features/admin/components/session-form.tsx`
- Create: `src/features/admin/components/session-table.tsx`
- Create: `src/features/admin/components/member-table.tsx`
- Create: `src/features/admin/components/booking-table.tsx`
- Create: `src/features/admin/components/order-table.tsx`
- Create: `src/app/admin/layout.tsx`
- Create: `src/app/admin/page.tsx`
- Create: `src/app/admin/schedules/page.tsx`
- Create: `src/app/admin/schedules/new/page.tsx`
- Create: `src/app/admin/schedules/[sessionId]/edit/page.tsx`
- Create: `src/app/admin/bookings/page.tsx`
- Create: `src/app/admin/members/page.tsx`
- Create: `src/app/admin/orders/page.tsx`
- Create: `src/app/admin/loading.tsx`
- Create: `src/app/admin/error.tsx`

**Interfaces:**
- `getAdminDashboard(): Promise<AdminDashboardData>` returns revenue, active member count, today booking count, and capacity summary.
- `createClassSession(input: CreateSessionInput): Promise<ActionResult<Session>>` validates with Zod and requires admin.
- `updateClassSession(input: UpdateSessionInput): Promise<ActionResult<Session>>` requires admin and rejects a session whose end precedes its start.
- `setSessionActive(input: { sessionId: string; active: boolean }): Promise<ActionResult<void>>` requires admin.
- `cancelBookingAsAdmin(input: { bookingId: string }): Promise<CancelBookingResult>` requires admin and calls the same transactional cancellation path.

- [ ] **Step 1: Write admin authorization and mutation tests**

  Assert that a member receives `FORBIDDEN` from dashboard and session mutations, while an admin can create a valid session. Assert invalid capacity, invalid time range, unknown class ID and missing required instructor name produce field-safe validation errors.

- [ ] **Step 2: Run the admin tests and confirm they fail**

  Run `pnpm test -- src/features/admin/actions.test.ts`.

  Expected: FAIL because the admin query／action layer does not exist.

- [ ] **Step 3: Implement admin queries and server actions**

  Every action calls `requireAdmin` before reading or writing. Use the authenticated Supabase server client where RLS can enforce the action; use the admin client only for aggregation or a mutation explicitly guarded by `requireAdmin`. Validate `startsAt`, `endsAt`, `capacity`, `classId`, and `instructorName` with Zod. Return `{ ok: false, code, fieldErrors }` instead of throwing raw database errors.

- [ ] **Step 4: Build the admin shell and dashboard**

  Create a responsive sidebar with links to Dashboard、Schedules、Bookings、Members、Orders. Use shadcn Card／Table／Badge; show four metric cards, a seven-day occupancy list, and the next ten sessions. Server-render the dashboard and display skeleton／error states.

- [ ] **Step 5: Build schedule CRUD**

  `/admin/schedules` lists active／inactive sessions with filters. New／edit forms use shadcn Form, Calendar, Select and Input; submit server actions and revalidate the schedule route. Deactivating a session must not delete bookings; the UI labels the session inactive and prevents new member booking.

- [ ] **Step 6: Build booking, member and order tables**

  Add searchable tables with status badges and safe empty states. Admin booking cancellation uses the transactional action, showing the restored credit only after the server confirms success. Member and order pages expose only operational fields: no card numbers, raw tokens, or full webhook payloads.

- [ ] **Step 7: Run admin verification**

  Run `pnpm test -- src/features/admin/actions.test.ts`, `pnpm lint`, and `pnpm build`. With a member session, request `/admin` and submit one mutation; expect 403／redirect. With an admin session, create and edit a session, then verify it appears in the public upcoming-session query.

- [ ] **Step 8: Commit the admin deliverable**

  ```bash
  git add -- src/features/admin/types.ts src/features/admin/queries.ts src/features/admin/actions.ts src/features/admin/actions.test.ts src/features/admin/components/admin-sidebar.tsx src/features/admin/components/metric-card.tsx src/features/admin/components/session-form.tsx src/features/admin/components/session-table.tsx src/features/admin/components/member-table.tsx src/features/admin/components/booking-table.tsx src/features/admin/components/order-table.tsx src/app/admin
  git commit --only -m "feat: add admin operations dashboard" -- src/features/admin/types.ts src/features/admin/queries.ts src/features/admin/actions.ts src/features/admin/actions.test.ts src/features/admin/components/admin-sidebar.tsx src/features/admin/components/metric-card.tsx src/features/admin/components/session-form.tsx src/features/admin/components/session-table.tsx src/features/admin/components/member-table.tsx src/features/admin/components/booking-table.tsx src/features/admin/components/order-table.tsx src/app/admin
  ```

---

### Task 8: 補齊端到端驗收、README、CI 與交付檢查

**Files:**
- Create: `e2e/fixtures.ts`
- Create: `e2e/member-booking.spec.ts`
- Create: `e2e/admin-operations.spec.ts`
- Create: `e2e/negative-paths.spec.ts`
- Create: `.github/workflows/ci.yml`
- Modify: `playwright.config.ts`
- Modify: `README.md`
- Modify: `.env.example`

**Interfaces:**
- `e2e/fixtures.ts` provides authenticated `memberPage` and `adminPage` fixtures using test-only seeded accounts; credentials come from environment variables, never source files.
- CI runs typecheck／Biome／Vitest／Next build against an empty secret-safe environment and skips only the live Stripe forwarding step.
- README provides exact local setup, Supabase reset／seed, Stripe CLI forwarding, test card, demo accounts, deployment variables and known Phase 2 boundaries.

- [ ] **Step 1: Write the member happy-path E2E test**

  Add a Playwright test that signs in a seeded member, opens `/classes`, selects a session with a known remaining spot, confirms the booking, opens `/account`, and cancels the booking. Assert the booking status and credit display after each server-confirmed transition.

- [ ] **Step 2: Write the admin and negative-path E2E tests**

  Add tests for admin session creation／edit／deactivation and these failures: member access to `/admin`, duplicate booking, booking a full session, insufficient credits, canceled Stripe checkout, and success page while webhook status is still `pending`.

- [ ] **Step 3: Implement deterministic E2E fixtures and test reset**

  Use `E2E_SEED=true` to create known future sessions and test accounts in a disposable Supabase project. Store `E2E_MEMBER_EMAIL`, `E2E_MEMBER_PASSWORD`, `E2E_ADMIN_EMAIL`, and `E2E_ADMIN_PASSWORD` in local environment variables. Reset the database before the suite so bookings and credits cannot leak between runs.

- [ ] **Step 4: Add CI checks and explicit secret behavior**

  Configure `.github/workflows/ci.yml` to run:

  ```bash
  pnpm install --frozen-lockfile
  pnpm lint
  pnpm test
  pnpm build
  ```

  The app must fail with a visible `CONFIGURATION_ERROR` state when Supabase or Stripe server variables are absent; CI must not manufacture a fake successful payment.

- [ ] **Step 5: Write the reproducible README**

  Document:

  ```text
  pnpm install
  supabase start
  supabase db reset
  stripe listen --forward-to http://127.0.0.1:3000/api/stripe/webhook
  pnpm dev
  ```

  Include the three plan names, Stripe test card `4242 4242 4242 4242`, local／hosted environment variable names, admin role seeding, test commands, and a clear statement that payment is Stripe test mode only.

- [ ] **Step 6: Run the complete verification matrix**

  Run `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm exec playwright test`, `supabase test db`, and the manual Stripe test flow. Inspect the rendered UI at 375px and 1440px widths; verify keyboard navigation, loading／empty／error states, and that no secret-like value appears in the browser bundle or logs.

- [ ] **Step 7: Run the final repository hygiene checks**

  Run `git diff --check`, `git status --short`, `pnpm lint`, `pnpm test`, and `pnpm build` after the E2E run. Confirm that only files listed by this task and the plan’s previous tasks changed, `.env.example` contains names but no values, and the browser bundle contains no service-role or Stripe secret.

- [ ] **Step 8: Commit the delivery deliverable**

  ```bash
  git add -- e2e/fixtures.ts e2e/member-booking.spec.ts e2e/admin-operations.spec.ts e2e/negative-paths.spec.ts .github/workflows/ci.yml playwright.config.ts README.md .env.example
  git commit --only -m "test: add end to end acceptance coverage" -- e2e/fixtures.ts e2e/member-booking.spec.ts e2e/admin-operations.spec.ts e2e/negative-paths.spec.ts .github/workflows/ci.yml playwright.config.ts README.md .env.example
  ```

## Spec coverage self-check

- Public／member routes and Quiet modern responsive UI: Task 6.
- Admin dashboard and CRUD surfaces: Task 7.
- Supabase Auth, PostgreSQL schema, RLS and seed: Tasks 2–3.
- Stripe subscription／one-time Checkout, webhook idempotency and status transitions: Task 4.
- 8-credit, unlimited and 1-credit membership semantics: Tasks 2 and 4–5.
- Atomic capacity／credit booking and cancellation: Task 2 and Task 5.
- Error states and secure secret handling: Tasks 3–4 and Task 8.
- Unit, integration, database, E2E, build and deployment verification: Tasks 1–2, 4–8.
- Non-goals remain excluded from implementation tasks and are documented in the spec and README.
