import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { test } from "./fixtures";

// The auto fixture checks local-only disposable targets before these clients exist.
function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: {persistSession: false, autoRefreshToken: false},
  });
}
async function register(page: Page) {
  const email = `registration-${randomUUID()}@example.test`;
  await page.goto("/signup?next=/account");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("密碼").fill(process.env.E2E_MEMBER_PASSWORD ?? "");
  await page.getByRole("button", {name: "建立帳號", exact: true}).click();
  await expect(page).toHaveURL(/\/account$/);
  const {data, error} = await serviceClient().auth.admin.listUsers({perPage: 1000});
  expect(error).toBeNull();
  const user = data.users.find(candidate => candidate.email === email);
  expect(user?.id).toBeTruthy();
  if (!user) throw new Error("Registered user not found.");
  const profile = await serviceClient().from("profiles").select("role").eq("id", user.id).single();
  expect(profile.error).toBeNull();
  expect(profile.data?.role).toBe("member");
  return user.id;
}

test("normal UI registration provisions a member profile without fixture upsert", async ({page}) => {
  const id = await register(page);
  const memberships = await serviceClient().from("memberships").select("id").eq("user_id", id);
  expect(memberships.error).toBeNull();
  expect(memberships.data).toEqual([]);
});

for (const path of ["/account", "/account/bookings", "/account/orders"]) {
  test(`signed-out account redirect preserves ${path}`, async ({page}) => {
    await page.goto(path);
    await expect(page).toHaveURL(url => url.pathname === "/login" && url.searchParams.get("next") === path);
  });
}

for (const plan of [
  {code: "single-class", name: "Single Class", priceVariable: "E2E_STRIPE_SINGLE_PRICE_ID", amount: 68000, recurring: false},
  {code: "starter-monthly", name: "Starter 8", priceVariable: "E2E_STRIPE_STARTER_PRICE_ID", amount: 288000, recurring: true},
]) {
  test(`real Stripe TEST Checkout → signed webhook → booking/cancellation: ${plan.name}`, async ({page, e2e}) => {
    test.skip(process.env.E2E_STRIPE !== "true", "Requires explicit E2E_STRIPE=true, test Prices and live local Stripe forwarding; no simulated payment success.");
    test.setTimeout(120_000);
    const key = process.env.STRIPE_SECRET_KEY ?? "";
    expect(key).toMatch(/^(sk|rk)_test_/);
    expect(Boolean(process.env.STRIPE_WEBHOOK_SECRET)).toBe(true);
    const priceId = process.env[plan.priceVariable];
    expect(Boolean(priceId)).toBe(true);
    if (!priceId) throw new Error(`Missing ${plan.priceVariable}.`);
    const stripe = new Stripe(key);
    const price = await stripe.prices.retrieve(priceId);
    expect(price.livemode).toBe(false);
    expect(price.active).toBe(true);
    expect(price.currency).toBe("twd");
    expect(price.unit_amount).toBe(plan.amount);
    expect(price.recurring?.interval ?? null).toBe(plan.recurring ? "month" : null);
    if (plan.recurring) expect(price.recurring?.interval_count).toBe(1);
    const configured = await serviceClient().from("plans").update({stripe_price_id: priceId}).eq("code", plan.code);
    expect(configured.error).toBeNull();
    const userId = await register(page);
    await page.goto("/plans");
    await page.getByTestId(`plan-${plan.code}`)
      .getByRole("button", {name: "選擇這個方案"}).click();
    await expect(page).toHaveURL(/^https:\/\/checkout\.stripe\.com\//);
    // Only enter Stripe's published test card after checking the actual session.
    const pending = await serviceClient().from("orders").select("id, stripe_checkout_session_id").eq("user_id", userId).single();
    expect(pending.error).toBeNull();
    if (!pending.data?.stripe_checkout_session_id) throw new Error("Checkout session was not linked.");
    const session = await stripe.checkout.sessions.retrieve(pending.data.stripe_checkout_session_id);
    expect(session.livemode).toBe(false);
    expect(session.url).toBe(page.url());
    await page.locator('input[name="cardNumber"]').fill("4242424242424242");
    await page.locator('input[name="cardExpiry"]').fill("1235");
    await page.locator('input[name="cardCvc"]').fill("123");
    const name = page.locator('input[name="billingName"]');
    if (await name.isVisible()) await name.fill("Local Test Member");
    const postal = page.locator('input[name="billingPostalCode"]');
    if (await postal.isVisible()) await postal.fill("100");
    await page.getByTestId("hosted-payment-submit-button").click();
    await expect(page).toHaveURL(/\/checkout\/success\?/, {timeout: 60_000});
    await expect(page.getByRole("heading", {name: "Payment confirmed", exact: true})).toBeVisible({timeout: 45_000});
    const membership = await serviceClient().from("memberships").select("id, credits_remaining")
      .eq("source_order_id", pending.data.id).single();
    expect(membership.error).toBeNull();
    expect(membership.data?.credits_remaining).toBe(plan.recurring ? 8 : 1);
    await page.goto(`/classes/${e2e.sessions.member.id}`);
    await page.getByRole("button", {name: "預約這堂課", exact: true}).click();
    await expect(page.getByText("預約已確認", {exact: true})).toBeVisible();
    await page.goto("/account/bookings");
    await page.getByRole("button", {name: "取消預約", exact: true}).click();
    await page.getByRole("button", {name: "確認取消", exact: true}).click();
    await expect(page.getByText("預約已取消。", {exact: true})).toBeVisible();
    const refunded = await serviceClient().from("memberships").select("credits_remaining")
      .eq("source_order_id", pending.data.id).single();
    expect(refunded.error).toBeNull();
    expect(refunded.data?.credits_remaining).toBe(plan.recurring ? 8 : 1);
    const ledger = await serviceClient().from("stripe_events").select("event_type").eq("order_id", pending.data.id);
    expect(ledger.error).toBeNull();
    expect(ledger.data?.some(row => row.event_type === (plan.recurring ? "invoice.paid" : "checkout.session.completed"))).toBe(true);
    const booking = await serviceClient().from("bookings").select("id")
      .eq("user_id", userId).eq("session_id", e2e.sessions.member.id).single();
    expect(booking.error).toBeNull();
    if (!booking.data) throw new Error("Booking not found.");
    await page.context().clearCookies();
    await page.goto("/login?next=/admin");
    await page.getByLabel("Email").fill(process.env.E2E_ADMIN_EMAIL ?? "");
    await page.getByLabel("密碼").fill(process.env.E2E_ADMIN_PASSWORD ?? "");
    await page.getByRole("button", {name: "登入", exact: true}).click();
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto("/admin/orders");
    await expect(page.getByTestId(`order-${pending.data.id}`)).toContainText("paid");
    await page.goto("/admin/members");
    await expect(page.getByTestId(`member-${userId}`)).toContainText("active");
    await page.goto("/admin/bookings");
    await expect(page.getByTestId(`booking-${booking.data.id}`)).toContainText("cancelled");
  });
}
