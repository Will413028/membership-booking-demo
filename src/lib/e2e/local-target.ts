const localHosts = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);

type E2ETargets = {
  supabaseUrl: string | undefined;
  appBaseUrl: string | undefined;
};

function isLocalHttpTarget(
  value: string | undefined,
  expectedPort: "54321" | "3000",
): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "http:" &&
      localHosts.has(url.hostname) &&
      url.port === expectedPort
    );
  } catch {
    return false;
  }
}

export function localE2ETargetError({
  supabaseUrl,
  appBaseUrl,
}: E2ETargets): string | null {
  if (!isLocalHttpTarget(supabaseUrl, "54321")) {
    return "E2E skipped: NEXT_PUBLIC_SUPABASE_URL must be the local Supabase CLI HTTP endpoint on port 54321.";
  }
  if (!isLocalHttpTarget(appBaseUrl, "3000")) {
    return "E2E skipped: E2E_BASE_URL must be a local HTTP app endpoint on port 3000.";
  }
  return null;
}
