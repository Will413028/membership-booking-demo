# Membership Booking Demo 設計規格

日期：2026-09-15  
狀態：設計已由使用者確認，待 implementation plan

## Context

這是一個用於爭取網站架設接案的獨立展示專案，模擬台北質感皮拉提斯／瑜伽工作室的會員預約系統。案件需求包含會員、預約、後台管理、下訂單結帳與美感網站；本專案以能展示完整端到端流程為成功標準，而不以生產環境的所有營運功能為目標。

專案品牌暫定為 **MOTION / ROOM**，視覺方向為 Quiet modern：霧灰綠、白、深墨色，資訊層級清楚，讓訪客能快速找到預約入口；登入後則優先呈現個人課表與剩餘額度。

## Goals

- 建立可獨立執行、可部署的 Next.js 全端應用。
- 讓訪客能註冊、選擇會員方案、以 Stripe test mode 完成付款，並在 webhook 成功後取得會員資格。
- 讓有效會員能依場次容量與剩餘堂數完成預約、取消預約，並在會員中心查看狀態。
- 讓管理員能管理課程場次、查看會員、預約與訂單。
- 以 shadcn/ui 建立一致且具接案展示品質的 responsive UI。
- 用 migration、seed、測試與 README 讓第三方能重現本機流程。

## Non-goals

- 不接真金流；Stripe 僅使用 test mode。
- 不做多分店、教練抽成、優惠券、發票、退款自動化或多語系。
- 不做正式簡訊、email 通知與 OAuth；通知與第三方登入可列為後續報價項目。
- 不把 production secret、Stripe webhook payload 或個人資料寫入 repository。

## Personas and success criteria

### Visitor / Member

訪客可以瀏覽課程與方案，不登入也能理解服務與價格；登入後可以購買方案、查看會員資格、預約有名額的場次、取消未開始的預約，並看到訂單紀錄。

### Admin

管理員可以進入受保護的後台，建立／編輯／停用課程與場次，查看會員、預約與訂單狀態；非管理員不能透過直接輸入 URL 或 API 存取管理資料。

### Done criteria

使用 Stripe 測試卡完成一次月訂閱與一次性單堂體驗後，對應的 webhook 能冪等地更新訂單與會員額度；會員可以預約並取消一堂課；後台能看到同一筆會員、預約與訂單資料。重複預約、額滿、額度不足、付款取消與權限不足都有可理解的錯誤狀態。

## Product scope and routes

### Public and member routes

| Route | Purpose | Access |
|---|---|---|
| `/` | Conversion-first 首頁：主 CTA、近期場次、方案入口、品牌信任 | Public |
| `/classes` | 日期／類型／強度篩選、課程詳情與剩餘名額 | Public |
| `/plans` | 8 堂月訂閱、無限月訂閱、單堂體驗 | Public |
| `/checkout` | 訂單摘要與 Stripe Checkout 導轉前狀態 | Signed-in |
| `/checkout/success` | 付款結果、等待 webhook 的狀態提示與返回會員中心 | Signed-in |
| `/checkout/cancel` | 付款取消後的恢復入口 | Signed-in |
| `/login` / `/signup` | Supabase email/password 認證 | Public |
| `/account` | Member-first dashboard：下堂課、方案週期、剩餘堂數、預約／訂單 | Member |
| `/account/bookings` | 預約列表、取消可用預約 | Member |
| `/account/orders` | 訂單與付款狀態 | Member |

### Admin routes

| Route | Purpose |
|---|---|
| `/admin` | 營收、活躍會員、今日預約、容量摘要 |
| `/admin/schedules` | 建立／編輯／停用場次，設定課程、教練、時間與容量 |
| `/admin/bookings` | 搜尋、篩選、查看與取消預約 |
| `/admin/members` | 會員方案、狀態與堂數使用情形 |
| `/admin/orders` | 訂單、付款狀態與 Stripe 對照 |

## Core flows

### Plan purchase

1. 使用者從 `/plans` 選擇方案。
2. Server action 從 PostgreSQL 讀取方案價格與 Stripe Price ID，建立 `pending` order。
3. Server 建立 Stripe Checkout Session：月訂閱使用 `mode=subscription`，單堂體驗使用 `mode=payment`。
4. 使用者完成或取消付款後返回 success／cancel route。
5. Stripe webhook 驗證 signature，使用 event ID 做冪等處理；付款成功才將 order 標成 `paid` 並建立或更新 membership。
6. 訂閱的 `invoice.paid` 開啟新週期並重置 8 堂額度；無限方案只更新週期，不設定額度。單堂體驗建立 30 天有效、1 堂額度的 membership。
7. 訂閱更新、付款失敗、取消與到期事件同步 membership status；前端不直接授予會員資格。方案升降級與週期中 proration 不在第一版範圍。

### Booking

1. 會員在 `/classes` 選擇場次，前端只提供顯示資料。
2. Server action 重新查詢會員有效資格與場次資料。
3. PostgreSQL transaction 鎖定場次並計算有效預約數，檢查容量、同一會員重複預約與剩餘堂數。
4. 寫入 booking；8 堂與單堂方案扣 1 堂，無限方案不扣額度。
5. 成功後回傳會員 dashboard 可讀的 booking；競爭寫入失敗時回傳額滿或狀態已變更，而不是顯示假成功。

### Cancellation

會員只能取消自己的、尚未開始且狀態為 `confirmed` 的預約。取消與堂數退回在同一 transaction 完成；管理員可在後台取消預約，但同樣受狀態規則約束。

## Architecture

```text
  Visitor / Member / Admin Browser
              │
              ▼
  Next.js App Router + shadcn/ui
       │ Server Actions / Route Handlers
       ├──────────────▶ Supabase Auth + PostgreSQL + RLS
       └──────────────▶ Stripe Checkout + Webhook
```

### Application boundaries

- `app/`：route groups、頁面、loading／error／not-found states。
- `components/ui/`：shadcn/ui generated primitives；產品元件放在 feature 或 shared components，不修改 generated primitive 的責任邊界。
- `lib/supabase/`：browser／server／admin client 建立與 session 讀取。
- `lib/stripe/`：Stripe client、Checkout Session builder、webhook event dispatcher。
- `lib/validation/`：Zod schemas；所有 server action 的輸入先驗證。
- `features/`：plans、memberships、classes、bookings、orders 的讀寫與 domain rules。
- `supabase/migrations/`：schema、constraint、RLS；`supabase/seed.sql`：可重現展示資料。

Next.js server actions／route handlers 是唯一的寫入入口。Supabase anon client 可在需要時供使用者讀取受 RLS 保護的資料；service-role key 只在 server-side webhook 與明確的管理操作使用。Stripe webhook 的 normalized event 由 server 呼叫資料庫 transaction RPC，讓 event ledger 與訂單／會員狀態在同一 transaction 內完成。

## Data model

| Table | Important fields and invariants |
|---|---|
| `profiles` | `id` references `auth.users`、`full_name`、`phone`、`role` (`member`／`admin`) |
| `plans` | `name`、`billing_type` (`subscription`／`one_time`)、`stripe_price_id`、`class_credits` (`8`／`NULL`／`1`)、`amount_twd_cents`、`active` |
| `memberships` | `user_id`、`plan_id`、`status`、`credits_total`、`credits_remaining`、Stripe customer／subscription IDs、current period |
| `classes` | `name`、`category`、`level`、`description`、`duration_minutes`、`instructor_name`、`active` |
| `class_sessions` | `class_id`、`starts_at`、`ends_at`、`capacity`、`active`；有效預約數由 bookings 計算 |
| `bookings` | `user_id`、`session_id`、`membership_id`、`status` (`confirmed`／`cancelled`)、created／cancelled timestamps |
| `orders` | `user_id`、`status` (`pending`／`paid`／`failed`／`cancelled`／`refunded`)、`amount_twd_cents`、currency、Stripe session ID |
| `order_items` | `order_id`、`plan_id`、quantity、`unit_amount_twd_cents` snapshot |
| `payments` | `order_id`、Stripe payment intent／subscription reference、status、processed timestamp |
| `stripe_events` | provider event ID unique、type、processed timestamp；不保存不必要的完整 payload |

Database constraints and transaction rules:

- 對 `bookings` 建立 `WHERE status = 'confirmed'` 的 `user_id + session_id` partial unique index。
- Booking mutation 在 transaction 內對 `class_sessions` 執行 `SELECT ... FOR UPDATE`，以 row lock 保護容量與額度檢查。
- Order amount 以資料庫方案價格為準；`order_items.unit_amount_twd_cents` 保留付款當下的 snapshot。
- Stripe event ID、Checkout Session ID 與必要的 provider references 皆具 unique constraint，讓 webhook retry 不會重複建立 membership、扣額度或改訂單。

## Security and error handling

- Supabase RLS：會員只能查詢／取消自己的 bookings、orders、memberships；公開讀取只允許 active plans、classes、class_sessions；admin role 才能查詢全站營運資料。
- 管理員權限同時在 server 端檢查，不信任 client route guard 或前端 role 欄位。
- Stripe webhook 先驗證 signature，再用 server-side service role 寫入；任何未驗證 event 不得改變訂單或會員狀態。
- `SUPABASE_SERVICE_ROLE_KEY`、Stripe secret key 與 webhook secret 只存在部署環境變數；`.env.example` 僅列名稱與用途。
- 錯誤回應不洩漏付款 secret、RLS 細節或其他會員資料；server logs 不記錄完整 token、卡號或 webhook payload。

| Condition | Expected behavior |
|---|---|
| Stripe Checkout cancelled | order 保持可追蹤的未完成狀態，顯示返回方案入口 |
| Payment failed | 顯示失敗原因的安全摘要，不啟用 membership，可重試 |
| Webhook delayed | success page 顯示 processing，重新查詢 order；不能因返回頁自行授權 |
| Duplicate webhook | 以 `stripe_events` idempotency no-op，維持單一 order／membership |
| Session full | transaction 回傳額滿，保留原畫面選其他場次 |
| Credits insufficient / expired membership | booking denied，導回方案頁或會員中心 |
| Duplicate booking | 回傳既有預約提示，不重複扣額度 |
| Expired session / unauthorized admin | 401／403，導向登入或無權限頁 |
| Transient network error | 保留表單輸入，顯示 retry；不在 client 盲目重送寫入 mutation |

## Testing and verification

### Unit tests

使用 Vitest 覆蓋方案 billing mode、價格與額度規則、會員資格、booking eligibility、取消與 Zod validation。

### Integration tests

覆蓋 Checkout Session 建立時從 DB 取價、webhook signature／event idempotency、order → membership 狀態轉換、subscription failure／cancellation 與 booking transaction 的容量／額度結果。RLS 以 member／admin／anonymous 三種身份驗證讀寫邊界。

### End-to-end tests

使用 Playwright 跑一條完整 happy path：註冊／登入 → 選月訂閱 → Stripe test card → webhook → 會員啟用 → 預約 → 會員中心查看 → 取消 → admin 查看訂單與預約。另跑額滿、重複預約、額度不足、付款取消與非 admin 進入後台等負向路徑。

### Local verification

README 會說明 `pnpm`、Supabase local migration／seed、Stripe CLI forwarding 與 test card；build、typecheck、Biome、Vitest、Playwright 都必須列入驗證指令。未設定第三方 secret 時，應顯示 setup error，不得靜默假裝付款成功。

## Deployment

- Vercel：Next.js application。
- Supabase hosted project：Auth、PostgreSQL、RLS 與 migration。
- Stripe test mode：Products／Prices 與 production webhook endpoint。
- Required environment contract：`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`、`STRIPE_SECRET_KEY`、`STRIPE_WEBHOOK_SECRET`、`NEXT_PUBLIC_SITE_URL`。
- Production demo 不使用真金流；使用者可透過 README 以測試帳號／測試卡重現流程。

## Design decisions and trade-offs

1. **Supabase 而非自建 API + database server**：較快交付 Auth、PostgreSQL、RLS 與 hosted deployment；代價是展示對 Supabase 的依賴，未來若客戶已有後端需抽換 repository／service boundary。
2. **Stripe test mode 而非真實台灣金流**：能完整展示 hosted checkout、subscription 與 webhook；代價是不能代表台灣正式收款，綠界／藍新應在正式報價階段以 adapter 替換。
3. **混合會員方案而非只有一種訂閱**：同時呈現 recurring billing、one-time payment 與額度扣抵；代價是 webhook 與會員週期狀態比單一月費複雜，因此把優惠券、退款與通知明確排除。
4. **Server-side mutation + transaction 而非 client optimistic booking**：能保護名額、額度與訂單不變量；代價是前端狀態更新稍慢，但可用 loading／processing state 清楚呈現。
5. **前台公開首頁＋登入後 dashboard 而非單一 dashboard**：同時滿足接案展示的轉換頁與產品操作頁；代價是需要維護兩種 navigation context，但頁面責任清楚。
