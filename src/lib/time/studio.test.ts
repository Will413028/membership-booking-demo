import { describe, expect, it } from "vitest";
import { studioDateTime, studioInstant } from "./studio";

describe("Taipei studio time", () => {
  it("converts the same wall time independently of the host timezone", () => {
    expect(studioInstant("2030-06-01T09:30")).toBe("2030-06-01T01:30:00.000Z");
    expect(studioDateTime("2030-06-01T01:30:00Z")).toBe("2030-06-01T09:30");
    expect(studioDateTime("2030-05-31T20:00:00Z")).toBe("2030-06-01T04:00");
  });
  it.each(["", "2030-02-30T09:00", "2030-06-01T25:00", "2030-06-01T09:00Z"])(
    "rejects invalid wall time %s",
    (value) => {
      expect(() => studioInstant(value)).toThrow();
    },
  );
});
