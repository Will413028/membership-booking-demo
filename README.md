# MOTION / ROOM membership booking demo

這是展示用的 Next.js、Supabase 與 Stripe test-mode 會員預約系統。付款與 webhook 僅限 Stripe test mode；它不會處理真實金流、真實卡號或 production customer data。

## Local setup

需要 Node.js 22、pnpm、Supabase CLI、Stripe CLI，以及 Docker（由 Supabase CLI 使用）。複製 `.env.example` 為未追蹤的 `.env.local`，再填入你自己的 local Supabase 與 Stripe test-mode 值；不要把任何值提交到 repository。

依序在兩個 terminal 執行：

```bash
pnpm install
supabase start
supabase db reset
stripe listen --forward-to http://127.0.0.1:3000/api/stripe/webhook
pnpm dev
```

`supabase db reset` 會套用 migrations 和 `supabase/seed.sql`。Stripe CLI 顯示的 webhook signing secret 只放在本機 `STRIPE_WEBHOOK_SECRET`。瀏覽器開啟 `http://127.0.0.1:3000`。

## Plans and Stripe boundary

可展示的三種方案為：

- `Starter 8`：每月 8 堂。
- `Unlimited`：每月不限堂數。
- `Single Class`：一次購買 1 堂。

Stripe Checkout 僅能使用 Stripe test mode。手動付款測試使用卡號 `4242 4242 4242 4242`、任意未來到期日、任意 CVC 與郵遞區號；不要輸入真實卡片資料。會員資格只能由驗證過的 Stripe webhook 啟用，success page 在訂單仍是 `pending` 時只會顯示 processing，不會自行授予資格。

## Environment contract

Local 與 hosted environment 都需要下列名稱；所有 server-only 值都只能設在 server/runtime，不得加上 `NEXT_PUBLIC_` 前綴。

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_SITE_URL`
- `SUPABASE_DB_URL`（僅 local tooling 選用）

Hosted demo 使用已部署的 Supabase project URL/anon key、server-only service role、Stripe test-mode secret 與該部署的 public site URL。不要在 CI、client bundle 或 log 中放入任一 secret。CI 用空白的 secret-safe environment 只跑 lint、unit tests 與 build；它不啟動 Stripe forwarding，也不模擬或偽造付款成功。

## Admin role and E2E fixtures

一般 seed 只建立方案、課程與未來場次。建立 local demo admin 後，使用 Supabase Dashboard 或 SQL editor 將該帳號對應的 `profiles.role` 設為 `admin`；其他帳號維持 `member`。只在 local/disposable project 做這個操作。

Playwright 不會自行開啟 app server，且預設安全 skip。E2E 固定只接受 local Supabase CLI endpoint（HTTP、`localhost`／`127.0.0.1`／`::1`、port `54321`）與 local app endpoint（HTTP、相同 local host、port `3000`）；remote、shared 與 production URL 一律以明確 prerequisite 訊息 skip。欲跑 E2E，先手動啟動 app，並在未追蹤的 local environment 填入 `E2E_MEMBER_EMAIL`、`E2E_MEMBER_PASSWORD`、`E2E_ADMIN_EMAIL`、`E2E_ADMIN_PASSWORD`、`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY` 和 `SUPABASE_SERVICE_ROLE_KEY`。另將 `E2E_SEED` 與 `E2E_DISPOSABLE_SUPABASE` 設為 true，並將 `E2E_RESET_COMMAND` 設為 `supabase db reset`。reset 會以 repository root 作為 cwd 執行，且只會在 local-only guards 全部通過後才 seed 測試帳號、future sessions、full session 與 pending checkout order。需要非預設 local host 時設 `E2E_BASE_URL`。

## Tests

```bash
pnpm lint
pnpm test
pnpm build
pnpm exec playwright test --list
pnpm e2e
```

`pnpm e2e` 需要上述 disposable database、E2E variables、已啟動的 app 與可用 Playwright browser binary。缺少 E2E prerequisite 時 specs 會以明確理由 skip；不要把 skip 當成 E2E 已通過。不要在一般 CI 執行 Stripe CLI forwarding 或 fake payment。

## Phase 2 boundaries

本 demo 不含真實台灣金流、多分店、教練抽成、優惠券、發票、退款自動化、多語系、正式 email/SMS 通知或 OAuth。這些需求應在正式專案的設計、報價與合規流程中另行處理。
