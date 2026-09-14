import { execFile } from "node:child_process";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { test as base, type Page } from "@playwright/test";
import { localE2ETargetError } from "../src/lib/e2e/local-target";

const execFileAsync = promisify(execFile);
const resetCommand = "supabase db reset";
const defaultAppBaseUrl = "http://127.0.0.1:3000";
const repositoryCwd = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const requiredEnvironment = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "E2E_MEMBER_EMAIL",
  "E2E_MEMBER_PASSWORD",
  "E2E_ADMIN_EMAIL",
  "E2E_ADMIN_PASSWORD",
] as const;

type SeededSessionName = "member" | "duplicate" | "full" | "insufficient";

type SeededSessions = Record<SeededSessionName, { id: string }>;

export type E2EContext = {
  sessions: SeededSessions;
  pendingOrderId: string;
  setMemberCredits(credits: number): Promise<void>;
};

type E2EFixtures = {
  e2e: E2EContext;
  memberPage: Page;
  adminPage: Page;
};

type SeedUser = {
  id: string;
  email: string;
};

const seededClasses: Array<{
  key: SeededSessionName;
  name: string;
  capacity: number;
}> = [
  { key: "member", name: "E2E Member Flow", capacity: 3 },
  { key: "duplicate", name: "E2E Duplicate Flow", capacity: 3 },
  { key: "full", name: "E2E Full Flow", capacity: 1 },
  { key: "insufficient", name: "E2E Credit Flow", capacity: 3 },
];

function prerequisiteMessage(): string | null {
  if (process.env.E2E_SEED !== "true") {
    return "E2E skipped: set E2E_SEED=true for a disposable Supabase project.";
  }
  if (process.env.E2E_DISPOSABLE_SUPABASE !== "true") {
    return "E2E skipped: set E2E_DISPOSABLE_SUPABASE=true only for a disposable project.";
  }
  if (process.env.E2E_RESET_COMMAND !== resetCommand) {
    return "E2E skipped: E2E_RESET_COMMAND must be exactly 'supabase db reset'.";
  }
  const targetError = localE2ETargetError({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    appBaseUrl: process.env.E2E_BASE_URL ?? defaultAppBaseUrl,
  });
  if (targetError) return targetError;
  const missing = requiredEnvironment.filter((name) => !process.env[name]);
  if (missing.length) {
    return `E2E skipped: missing required environment variables: ${missing.join(", ")}.`;
  }
  return null;
}

function adminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("E2E Supabase credentials are unavailable.");
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function resetDatabase(): Promise<void> {
  await execFileAsync("supabase", ["db", "reset"], {
    cwd: repositoryCwd,
    env: process.env,
  });
}

async function createSeedUser(
  client: SupabaseClient,
  input: { email: string; password: string; role: "member" | "admin" },
): Promise<SeedUser> {
  const { data, error } = await client.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error("E2E seed could not create a test auth user.");
  }

  const { error: profileError } = await client.from("profiles").upsert({
    id: data.user.id,
    full_name: `E2E ${input.role}`,
    role: input.role,
  });
  if (profileError) {
    throw new Error("E2E seed could not create the test profile.");
  }
  return { id: data.user.id, email: input.email };
}

async function starterPlanId(client: SupabaseClient): Promise<string> {
  const { data, error } = await client
    .from("plans")
    .select("id")
    .eq("code", "starter-monthly")
    .single();
  if (error || !data || typeof data.id !== "string") {
    throw new Error("E2E seed requires the starter-monthly plan from supabase/seed.sql.");
  }
  return data.id;
}

async function createMembership(
  client: SupabaseClient,
  userId: string,
  planId: string,
  credits: number,
): Promise<string> {
  const now = new Date();
  const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const { data, error } = await client
    .from("memberships")
    .insert({
      user_id: userId,
      plan_id: planId,
      status: "active",
      credits_total: 8,
      credits_remaining: credits,
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
    })
    .select("id")
    .single();
  if (error || !data || typeof data.id !== "string") {
    throw new Error("E2E seed could not create test membership credits.");
  }
  return data.id;
}

async function createSeededSessions(
  client: SupabaseClient,
): Promise<SeededSessions> {
  const start = Date.now() + 90 * 24 * 60 * 60 * 1000;
  const result = {} as SeededSessions;

  for (const [index, definition] of seededClasses.entries()) {
    const { data: classData, error: classError } = await client
      .from("classes")
      .insert({
        name: definition.name,
        category: "E2E",
        level: "Test only",
        description: "Disposable end-to-end fixture.",
        duration_minutes: 60,
        instructor_name: "E2E Instructor",
        active: true,
      })
      .select("id")
      .single();
    if (classError || !classData || typeof classData.id !== "string") {
      throw new Error("E2E seed could not create a fixture class.");
    }

    const startsAt = new Date(start + index * 24 * 60 * 60 * 1000);
    const { data: sessionData, error: sessionError } = await client
      .from("class_sessions")
      .insert({
        class_id: classData.id,
        starts_at: startsAt.toISOString(),
        ends_at: new Date(startsAt.getTime() + 60 * 60 * 1000).toISOString(),
        capacity: definition.capacity,
        active: true,
      })
      .select("id")
      .single();
    if (sessionError || !sessionData || typeof sessionData.id !== "string") {
      throw new Error("E2E seed could not create a fixture session.");
    }
    result[definition.key] = { id: sessionData.id };
  }
  return result;
}

async function seedE2EData(): Promise<void> {
  const client = adminClient();
  const member = await createSeedUser(client, {
    email: process.env.E2E_MEMBER_EMAIL ?? "",
    password: process.env.E2E_MEMBER_PASSWORD ?? "",
    role: "member",
  });
  await createSeedUser(client, {
    email: process.env.E2E_ADMIN_EMAIL ?? "",
    password: process.env.E2E_ADMIN_PASSWORD ?? "",
    role: "admin",
  });
  const planId = await starterPlanId(client);
  await createMembership(client, member.id, planId, 8);
  const sessions = await createSeededSessions(client);

  const occupant = await createSeedUser(client, {
    email: `e2e-occupied-${crypto.randomUUID()}@e2e.invalid`,
    password: crypto.randomUUID(),
    role: "member",
  });
  const occupantMembershipId = await createMembership(
    client,
    occupant.id,
    planId,
    8,
  );
  const { error: occupancyError } = await client.from("bookings").insert({
    user_id: occupant.id,
    session_id: sessions.full.id,
    membership_id: occupantMembershipId,
  });
  if (occupancyError) {
    throw new Error("E2E seed could not fill the full-session fixture.");
  }

  const { data: order, error: orderError } = await client
    .from("orders")
    .insert({ user_id: member.id, status: "pending", amount_twd_cents: 0 })
    .select("id")
    .single();
  if (orderError || !order || typeof order.id !== "string") {
    throw new Error("E2E seed could not create a pending checkout order.");
  }
  const { error: orderItemError } = await client.from("order_items").insert({
    order_id: order.id,
    plan_id: planId,
    unit_amount_twd_cents: 0,
  });
  if (orderItemError) {
    throw new Error("E2E seed could not create the pending checkout order item.");
  }
}

async function userByEmail(client: SupabaseClient, email: string): Promise<SeedUser> {
  const { data, error } = await client.auth.admin.listUsers({ perPage: 1000 });
  const user = data?.users.find((candidate) => candidate.email === email);
  if (error || !user?.id || !user.email) {
    throw new Error("E2E seed account was not found after reset.");
  }
  return { id: user.id, email: user.email };
}

async function lookupContext(): Promise<E2EContext> {
  const client = adminClient();
  const member = await userByEmail(client, process.env.E2E_MEMBER_EMAIL ?? "");
  const { data: classes, error: classesError } = await client
    .from("classes")
    .select("id, name")
    .in(
      "name",
      seededClasses.map((definition) => definition.name),
    );
  if (classesError || !classes || classes.length !== seededClasses.length) {
    throw new Error("E2E fixture classes were not found after reset.");
  }
  const classIds = classes.map((record) => record.id as string);
  const { data: sessionRows, error: sessionsError } = await client
    .from("class_sessions")
    .select("id, class_id")
    .in("class_id", classIds);
  if (sessionsError || !sessionRows) {
    throw new Error("E2E fixture sessions were not found after reset.");
  }
  const sessions = {} as SeededSessions;
  for (const definition of seededClasses) {
    const fixtureClass = classes.find((record) => record.name === definition.name);
    const session = sessionRows.find(
      (record) => record.class_id === fixtureClass?.id,
    );
    if (!session || typeof session.id !== "string") {
      throw new Error("An E2E fixture session is missing.");
    }
    sessions[definition.key] = { id: session.id };
  }

  const { data: pendingOrder, error: pendingOrderError } = await client
    .from("orders")
    .select("id")
    .eq("user_id", member.id)
    .eq("status", "pending")
    .single();
  if (pendingOrderError || !pendingOrder || typeof pendingOrder.id !== "string") {
    throw new Error("The E2E pending checkout order is missing.");
  }

  return {
    sessions,
    pendingOrderId: pendingOrder.id,
    async setMemberCredits(credits: number) {
      const { error } = await client
        .from("memberships")
        .update({ credits_remaining: credits })
        .eq("user_id", member.id)
        .eq("status", "active");
      if (error) {
        throw new Error("E2E fixture could not set member credits.");
      }
    },
  };
}

async function login(
  page: Page,
  credentials: { email: string; password: string },
): Promise<void> {
  await page.goto("/login?next=/account");
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("密碼").fill(credentials.password);
  await page.getByRole("button", { name: "登入" }).click();
  await page.waitForURL("**/account");
}

export const test = base.extend<E2EFixtures>({
  e2e: [
    async ({}, use, testInfo) => {
      const reason = prerequisiteMessage();
      if (reason) {
        testInfo.skip(true, reason);
        return;
      }
      await use(await lookupContext());
    },
    { auto: true },
  ],
  memberPage: async ({ page }, use) => {
    await login(page, {
      email: process.env.E2E_MEMBER_EMAIL ?? "",
      password: process.env.E2E_MEMBER_PASSWORD ?? "",
    });
    await use(page);
  },
  adminPage: async ({ page }, use) => {
    await login(page, {
      email: process.env.E2E_ADMIN_EMAIL ?? "",
      password: process.env.E2E_ADMIN_PASSWORD ?? "",
    });
    await use(page);
  },
});

export default async function globalSetup(): Promise<void> {
  const reason = prerequisiteMessage();
  if (reason) {
    console.warn(reason);
    return;
  }
  await resetDatabase();
  await seedE2EData();
}
