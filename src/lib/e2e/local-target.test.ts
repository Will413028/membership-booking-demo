import { describe, expect, it } from "vitest";

import { localE2ETargetError } from "./local-target";

describe("localE2ETargetError", () => {
  it("allows only the local Supabase CLI and app endpoints", () => {
    expect(
      localE2ETargetError({
        supabaseUrl: "http://127.0.0.1:54321",
        appBaseUrl: "http://localhost:3000",
      }),
    ).toBeNull();
  });

  it.each([
    ["https://project.supabase.co", "http://127.0.0.1:3000"],
    ["http://127.0.0.1:54321", "https://demo.example.com"],
    ["http://localhost:54322", "http://127.0.0.1:3000"],
    ["http://localhost:54321", "http://localhost:3001"],
  ])("rejects non-local target %s / %s", (supabaseUrl, appBaseUrl) => {
    expect(localE2ETargetError({ supabaseUrl, appBaseUrl })).toMatch(
      /E2E skipped:.*local/i,
    );
  });
});
