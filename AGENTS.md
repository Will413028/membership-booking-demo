# Membership booking demo

Next.js + Supabase + Stripe test-mode 會員預約展示。改行為前讀 `README.md` 的 Plans and Stripe boundary、Database RPC compatibility、Admin role and E2E fixtures；環境與部署流程也以 README 為入口。

程式在 `src/`（`app/` 路由、`features/` 業務模組、`lib/` 共用）；資料庫在 `supabase/`（`migrations/`、`tests/`、`seed.sql`）。

- 決策紀錄（ADR）：`docs/adr/`。
- 僅限 Stripe test mode，不能處理真實卡號或 production customer data；server-only credentials 不進 client、log 或 Git。
- 會員資格由驗證後的付款 webhook 授予，success page 不授權；保留 event ordering、重送冪等與 invoice 原週期判斷。
- 不信任 signup metadata 的 admin role；DB 權限與 RPC 授權不可由 UI guard 取代。預約維持容量與會員資格鎖定，取消只退原扣堂週期。
- repo root 基本驗證：`pnpm lint`、`pnpm test`、`pnpm build`。行為改動補受影響回歸；純文件改動核對契約與路徑即可。
- `pnpm e2e` 需要 README 列出的 disposable local Supabase、app server 與 fixtures；預設 skip 不是通過。不要對 hosted/shared DB 跑 reset／seed，也不把測試結果當正式付款或 migration 已成功的證據。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
