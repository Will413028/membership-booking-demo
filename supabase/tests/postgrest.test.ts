import {createClient, type SupabaseClient} from "@supabase/supabase-js";
import {beforeAll, expect, it, vi} from "vitest";
vi.mock("@/lib/supabase/server", () => ({createServerClient: async () => client}));
import {getActiveMembership} from "../../src/features/bookings/queries";
import {listAdminBookings, listAdminMembers, listAdminOrders, listAdminSchedules} from "../../src/features/admin/queries";
let client: SupabaseClient;

beforeAll(() => {
  const target = new URL(process.env.PGTAP_REST_URL ?? "http://invalid");
  if (target.protocol !== "http:" || target.hostname !== "127.0.0.1" || target.port !== "55434") {
    throw new Error("Requires dedicated disposable PostgREST at http://127.0.0.1:55434, never a deployed service.");
  }
  client = createClient(target.origin, "local-fixture-placeholder", {
    auth: {persistSession: false, autoRefreshToken: false},
    global: {fetch: (input, init) => {
      const url = new URL(String(input));
      url.pathname = url.pathname.replace(/^\/rest\/v1/, "");
      const headers = new Headers(init?.headers);
      headers.delete("Authorization");
      headers.delete("apikey");
      return fetch(url, {...init, headers});
    }},
  });
  // Auth/RLS are tested by actual SET ROLE in pgTAP. Here only auth identity is
  // stubbed; all schema discovery, filters, embedding and data mapping hit PostgreSQL.
  vi.spyOn(client.auth, "getUser").mockResolvedValue({
    data: {user: {id: "00000000-0000-0000-0000-000000000012", email: "admin@example.test"}}, error: null,
  } as never);
});
it("maps actual bookings→profiles and nested class relationships", async () => {
  const rows = await listAdminBookings();
  expect(rows.some(row => row.className === "pgTAP Class" && row.memberName === "Member")).toBe(true);
});
it("maps actual profiles→memberships reverse relationships", async () => {
  const rows = await listAdminMembers();
  expect(rows.find(row => row.id === "00000000-0000-0000-0000-000000000001")?.membershipStatus).not.toBeNull();
});
it("maps actual order buyer and plan relationships", async () => {
  const rows = await listAdminOrders();
  expect(rows.find(row => row.id === "00000000-0000-0000-0000-000000000021")).toMatchObject({memberName: "Member", planName: "Monthly", status: "paid"});
});
it("maps actual confirmed count aggregates, excluding canceled bookings", async () => {
  const rows = await listAdminSchedules();
  expect(rows.find(row => row.id === "00000000-0000-0000-0000-000000000004")).toMatchObject({confirmedCount: 1, capacity: 2});
});
it("selects earliest usable finite membership despite a newer exhausted membership", async () => {
  expect(await getActiveMembership("00000000-0000-0000-0000-000000000001", client))
    .toMatchObject({id: "00000000-0000-0000-0000-000000000031", creditsRemaining: 1});
});
it("selects unlimited membership deterministically among multiple valid memberships", async () => {
  expect(await getActiveMembership("00000000-0000-0000-0000-000000000011", client))
    .toMatchObject({id: "00000000-0000-0000-0000-000000000033", creditsRemaining: null});
});
it("supports the dashboard's earliest future-session ordering at PostgREST", async () => {
  const {data, error} = await client.from("bookings")
    .select("id,status,class_sessions!inner(starts_at,classes(name,instructor_name))")
    .eq("user_id", "00000000-0000-0000-0000-000000000001").eq("status", "confirmed")
    .gt("class_sessions.starts_at", new Date().toISOString())
    .order("class_sessions(starts_at)", {ascending: true}).limit(8);
  expect(error).toBeNull();
  expect(data).toHaveLength(1);
});
