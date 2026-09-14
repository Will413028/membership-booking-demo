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

Seed 的 `stripe_price_id` 刻意留空；空值會安全拒絕 Checkout。請先在 **Stripe test mode** 建立三個 Product／Price（TWD，停用 trial、coupon、proration）：

| Plan code | Price | Billing |
| --- | --- | --- |
| `starter-monthly` | NT$2,880（`unit_amount=288000`） | 每月、interval_count=1 |
| `unlimited-monthly` | NT$4,680（`unit_amount=468000`） | 每月、interval_count=1 |
| `single-class` | NT$680（`unit_amount=68000`） | 一次性，資格 30 天 |

在該 local/test project 的 SQL editor 將三個實際 `price_...` ID 分別填入 `public.plans.stripe_price_id`，以 `code` 精確定位。不要改 seed 成共用帳戶的真實 ID；每次 reset 後重新設定。Webhook endpoint 必須接收 `checkout.session.completed`、`checkout.session.async_payment_succeeded`、`invoice.paid`、`invoice.payment_failed`、`customer.subscription.updated`、`customer.subscription.deleted`。Server key 僅接受 `sk_test_`／`rk_test_`；verified event 與其 object 都必須是 test mode。

Stripe Checkout 僅能使用 Stripe test mode。手動付款測試使用卡號 `4242 4242 4242 4242`、任意未來到期日、任意 CVC 與郵遞區號；不要輸入真實卡片資料。會員資格只能由驗證過的 Stripe webhook 啟用，success page 在訂單仍是 `pending` 時只會顯示 processing，不會自行授予資格。

未付款的 completed event 不授權；延遲付款由 async success／paid invoice 處理。月訂閱的第一期與續期都只依 `invoice.paid` 的 subscription line period 發堂數，絕不重新 retrieve「目前」subscription period。Checkout 即使已 paid，仍可能顯示 processing，直到該 order 的 membership 建立。相同 order 只能產生一筆 membership，同期 invoice 不會重設已花費堂數。欠款／取消狀態有 event 時序與 invoice period 防護；取消為該 subscription 的終止狀態。同秒衝突採保守排序：canceled > adverse status > paid > active update。

### Database RPC compatibility

`202609150003_final_integrity_hardening.sql` 保留八參數 `apply_stripe_event(text,text,uuid,text,text,timestamptz,timestamptz,text)` wrapper，但它只能 no-op 已記錄的 retry；新事件因缺乏 payment/status/ordering evidence，回傳 `STRIPE_EVENT_CONTEXT_REQUIRED`（不存在 order 仍為 `ORDER_NOT_FOUND`）。部署時先套 migration，再更新 webhook caller：

```text
apply_stripe_event_v2(
  p_provider_event_id text, p_event_type text, p_order_id uuid,
  p_customer_id text, p_subscription_id text, p_period_start timestamptz,
  p_period_end timestamptz, p_payment_reference text,
  p_event_created_at timestamptz, p_membership_status membership_status,
  p_payment_status text
)
```

兩個入口都明確禁止 PUBLIC／anon／authenticated，只允許 service_role。不能用八個原始參數安全表達 Stripe 的 actual status、付款證據及 event.created；因此不能把舊 caller 的新事件默認成 paid／active。暫時的部署版本落差會讓 webhook retry，不會授予資格。Legacy subscription 只回填可證明的 order 關係；沒有證據的舊 one-time grant 不猜測連結，需人工對帳。未能證明原週期的舊 booking 不跨期退堂。

一般 signup 的 auth.users INSERT trigger 固定建立 member profile，忽略 metadata 中的 admin role。場次建立／編輯一律輸入 Asia/Taipei studio time，再送出含 UTC offset 的 instant。預約鎖定場次、parent class 與會員資格；capacity 不能降到 confirmed bookings 以下。取消仍可完成，但只在原扣堂 period 退堂，不把上期堂數加到新一期。

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

新增的 signup 測試走真正 UI registration／Auth trigger，不使用 profile upsert。原 seeded booking specs 是操作測試，**不是付款驗收**。要另外執行 Single Class 與 Starter 8 的完整真實 test-payment 流程，設定 `E2E_STRIPE=true`、`E2E_STRIPE_SINGLE_PRICE_ID`、`E2E_STRIPE_STARTER_PRICE_ID`，並提供 test key、webhook secret 與正在運作的 Stripe CLI forwarding。測試先 retrieve Price／Checkout 驗證 test mode 與金額，再填 Stripe 測試卡；不造 webhook、不直接把 order 改為 paid、不 seed 該註冊會員的資格。此 opt-in 會在 Stripe **test account** 建立付款與測試 subscription；完成後可在 test dashboard 清理／取消。Local `supabase/config.toml` 的 email confirmations 已關閉；不要把這個測試設定套用至 production。

DB 驗證可在 local Supabase 執行 `supabase test db`。沒有完整 Supabase CLI 時，也能在獨立、可拋棄的 Supabase PostgreSQL 17 container 依序套用三個 migrations、seed、建立 `pgtap` extension，再用 `psql -At -v ON_ERROR_STOP=1` 執行 `supabase/tests/booking_invariants.sql`；必須同時檢查 TAP 的 `not ok` 與 plan count，不能只看 psql exit code。

獨立 PostgREST integration harness：只在 task-owned disposable DB 將 pgTAP fixture 最後的 rollback 轉為 commit，套 `supabase/tests/query_memberships.sql`，並將 service-role-only PostgREST 綁在 `127.0.0.1:55434`（不對外開放）。執行 `PGTAP_REST_URL=http://127.0.0.1:55434 pnpm exec vitest run --config supabase/tests/postgrest.config.ts`，再跑 `node supabase/tests/concurrency.mjs <task-owned-container>`。後者要求 container 名稱以 `membership-remediation-` 開頭且 label `task=membership-remediation`，會改動 fixture，重跑需新 disposable DB。它驗證兩連線搶位與容量調整競爭；PostgREST harness 驗證真實 embedding／排序，不宣稱其 auth stub 是 RLS 測試。RLS coverage 在 pgTAP 使用實際 SET ROLE。

## Phase 2 boundaries

本 demo 不含真實台灣金流、多分店、教練抽成、優惠券、發票、退款自動化、多語系、正式 email/SMS 通知或 OAuth。這些需求應在正式專案的設計、報價與合規流程中另行處理。
