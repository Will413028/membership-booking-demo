---
title: 展示版採 Stripe test mode，正式金流延後
date: 2026-09-17
status: active
tags: [membership-booking-demo, decision, stripe, payment]
---

# 展示版採 Stripe test mode，正式金流延後

## Context

本專案的目的，是提供可公開展示的會員預約系統作品。需求需要下訂單、Checkout、會員資格與 webhook 的完整故事，但尚未有真實商戶、收款帳戶或台灣正式金流規格。

Prior state：設計稿已將 Stripe test mode 定為第一版 non-goal 邊界，並以 hosted Checkout 與 signed webhook 作為 demo 成功標準。

## Options Considered

- **A. Stripe test mode（選用）**：建立真實可操作但不收真錢的 Checkout、webhook、訂單與會員資格流程。
- **B. Stripe live mode**：現在就接正式 Stripe 帳戶與真實付款流程。
- **C. 台灣金流 provider**：現在改接綠界／藍新等本地正式收款服務。

## Decision

- 第一版展示環境採 **Stripe test mode**；正式收款與台灣金流不在本 project 的交付邊界內。
- demo 仍保留 recurring subscription、one-time payment、webhook 與 membership state transition，使客戶能看到完整端到端流程。

## Rationale

- 相較 live mode，test mode 可以用可撤銷的測試卡完成 hosted Checkout 與 webhook 驗證，不接觸真實 customer data，也不需要先處理 merchant onboarding、退款、發票與付款爭議。
- 不選台灣 provider，因為目前沒有客戶指定商戶、對帳、發票或退款契約；先做 adapter 反而會把展示專案綁到未確認的供應商。代價是這個 demo 不能宣稱已具備正式台灣收款能力。
- 不選 live mode 的另一個代價是 production payment、通知與合規仍需另立 scope；這個代價可被明確標示，而不會讓展示環境誤收款。

## Expected Outcome

- 客戶可透過公開 Vercel demo 操作方案選擇、Stripe test Checkout、付款後會員啟用與預約流程。
- 任何成功頁只在驗證過的 webhook 完成後顯示 membership active；repository 不保存 production secret 或付款資料。
- 正式專案可依客戶需求替換 payment adapter，不需要把展示版的測試資料與正式收款責任混在一起。

## Followup

- 若客戶要求正式收款，另開正式 payment scope，先確認台灣 provider、merchant／帳務、退款／發票、通知與合規需求，再決定是否 supersede 本 ADR。

## Invariants

- Stripe server key、webhook secret 與 service-role key 只存在 server/runtime；Checkout 金額與 Price ID 以資料庫方案為來源。
- Membership 只能由 verified Stripe webhook 授予，success page 不得自行 activation；Stripe test mode 的邊界由 key prefix 與 verified event 的 `livemode=false` 維持。

## Revocation Triggers

- 當第一個正式客戶要求真實收款、production customer data 或台灣金流對帳時，立即重評本 ADR，而不是直接把 test key 替換成 live key。
- 當展示環境需要公開接收真實付款時，撤銷本 ADR 並先完成正式金流的安全、合規與退款設計。

## Review Notes

初版建立；正式客戶需求出現時重審。

## Related

- **SDD spec**：先執行 `git log --all --oneline -- docs/superpowers | head -1` 取得 `d5a6687`，再以 `git show d5a6687:docs/superpowers/specs/2026-09-15-membership-booking-demo-design.md` 取回設計稿；其中 Non-goals 與 Design decisions 保留本取捨。
- **使用者討論**：Stripe test mode 是本 project 啟動時由使用者確認的範圍；本 ADR 即該拍板的 durable record，無另一份外部會議文件。
- [Supabase migrations 由 GitHub Actions 自動套用](2026-09-17-supabase-migrations-via-github-actions.md)
