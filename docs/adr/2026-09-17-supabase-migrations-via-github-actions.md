---
title: Supabase migrations 由 GitHub Actions 自動套用
date: 2026-09-17
status: active
tags: [membership-booking-demo, decision, ci-cd, supabase, migrations]
---

# Supabase migrations 由 GitHub Actions 自動套用

## Context

展示版已部署到 Vercel 與 hosted Supabase；若每次 merge `main` 還要由人手動套 migration，部署狀態會分叉，也無法在 GitHub 留下可查的 migration 證據。使用者要求 CI/CD 後不再手動部署，因此需要選定 production migration 的觸發方式與資料庫連線邊界。

## Options Considered

- **A. GitHub Actions 自動 migration（選用）**：`main` 的 `supabase/migrations/**` 變更觸發 `supabase db push --db-url`，以 production environment secret 的 Session pooler URL 連 hosted project。
- **B. 本機手動 `supabase db push`**：每次由開發者自行執行 migration，CI 只驗證程式碼與 build。
- **C. Supabase dashboard／Personal Access Token 驅動**：由 dashboard 或較高權限的 PAT 管理 hosted migration。

## Decision

- 採 **A**：GitHub Actions 在 `main` 的 migration 變更時自動套用 Supabase migrations；保留 `workflow_dispatch` 作為可追蹤的人工重跑入口。
- 連線使用 GitHub production environment 的 `SUPABASE_DB_URL`，值採 hosted Session pooler connection string；不把 Supabase Personal Access Token 或資料庫密碼寫入 repository、workflow 或 log。
- Vercel 繼續使用 Git integration 自動部署；不在 workflow 內另跑 `vercel deploy`，避免同一 commit 重複部署。

## Rationale

- **A** 提供可重現、可審計的 merge-to-production 路徑，並用 `paths` filter 避免無關改動套 migration；代價是要管理一個 production secret，且必須驗證 GitHub-hosted runner 到 managed Postgres 的實際可達性。
- 不選 **B**，因為它設定成本較低，卻把 migration 的效力交給個人操作，容易產生「程式已部署、schema 尚未套用」的漂移。
- 不選 **C**，因為 dashboard／PAT 雖可少寫 workflow，卻增加手動步驟或較寬的權限範圍，審計軌跡也不如 repo commit 對應的 Actions run 清楚。
- direct Supabase host 在 GitHub-hosted runner 的第一次驗證撞到 IPv6 連線失敗；相較直接改 migration SQL，改用 provider 官方 Session pooler 保留 migration 語意並成功重跑。代價是未來若更換 provider 或 pooler 模式，需重新驗證 session-level migration 行為。

## Expected Outcome

- Pull Request 先經 CI／Vercel Preview；merge `main` 後，Vercel Production 與 Supabase migration 各自以同一 commit 自動執行。
- migration job 使用固定的 Supabase CLI `2.117.0`、production environment secret 與 `supabase-production-migrations` concurrency group；正在執行的 production migration 不會被新 run 取消。
- migration 成功／失敗可從 GitHub Actions 追溯；遇到 transient runner 或 endpoint 問題可用 `workflow_dispatch` 重跑，而不是在本機留下未記錄的狀態。

## Invariants

- `SUPABASE_DB_URL` 只存在 GitHub production environment；不得出現在 repository、workflow source、client bundle 或 log。
- Workflow 只對 `main` 的 `supabase/migrations/**` 變更自動觸發；非 migration 變更不應單獨套用資料庫。
- Vercel 只由 Git integration 部署，CI 不重複呼叫 Vercel CLI。

## Revocation Triggers

- 當正式客戶需要多環境 migration promotion、required reviewer、rollback contract 或不同的 DB provider 時，重新評估本 ADR。
- 當 provider 的 Session pooler 不再支援 migration 所需的 session-level 行為，停止沿用目前 endpoint，先重做連線與 migration gate 設計。

## Review Notes

初版建立；正式環境／provider 邊界改變時重審。

## Related

- Workflow：[`supabase-migrations.yml`](https://github.com/Will413028/membership-booking-demo/blob/2eab6fa846178e1691211d5e0b9338b47a04a2a7/.github/workflows/supabase-migrations.yml)
- CI run：[35174747591](https://github.com/Will413028/membership-booking-demo/actions/runs/35174747591)
- Migration run：[35174945799](https://github.com/Will413028/membership-booking-demo/actions/runs/35174945799)
- 使用者討論：本 ADR 即「之後不用手動部署」的 durable record，無另一份外部會議文件。
- [展示版採 Stripe test mode](2026-09-17-stripe-test-mode-demo-boundary.md)
