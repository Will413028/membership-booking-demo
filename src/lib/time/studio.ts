export const STUDIO_TIME_ZONE = "Asia/Taipei";

/** Modern Taipei studio dates use UTC+08:00, independently of the browser/host. */
export function studioDateTime(value: string): string {
  const instant = new Date(value).getTime();
  if (!Number.isFinite(instant)) return "";
  return new Date(instant + 8 * 60 * 60 * 1000).toISOString().slice(0, 16);
}

export function studioInstant(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    throw new Error("Invalid studio time.");
  const instant = new Date(`${value}:00+08:00`);
  if (
    !Number.isFinite(instant.getTime()) ||
    studioDateTime(instant.toISOString()) !== value
  ) {
    throw new Error("Invalid studio time.");
  }
  return instant.toISOString();
}
