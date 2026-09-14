const FALLBACK_PATH = "/account";
const INTERNAL_ORIGIN = "https://motion-room.invalid";

function hasUnsafeCharacters(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (character === "\\" || code <= 0x1f || code === 0x7f) return true;
  }

  return false;
}

function fullyDecode(value: string): string | null {
  let decoded = value;

  while (decoded.includes("%")) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) return decoded;
      decoded = next;
    } catch {
      return null;
    }
  }

  return decoded;
}

export function safeNext(value: FormDataEntryValue | null): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) {
    return FALLBACK_PATH;
  }

  const decoded = fullyDecode(value);
  if (
    !decoded ||
    hasUnsafeCharacters(decoded) ||
    !decoded.startsWith("/") ||
    decoded.startsWith("//")
  ) {
    return FALLBACK_PATH;
  }

  try {
    const url = new URL(value, INTERNAL_ORIGIN);
    if (url.origin !== INTERNAL_ORIGIN) return FALLBACK_PATH;

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return FALLBACK_PATH;
  }
}
