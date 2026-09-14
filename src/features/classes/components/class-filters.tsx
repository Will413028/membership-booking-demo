"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Label } from "@/components/ui/label";

const categories = ["", "Yoga", "Pilates", "Mobility"];
const levels = ["", "Beginner", "Intermediate", "All levels"];

export function ClassFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const update = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.replace(`${pathname}${params.size ? `?${params}` : ""}`);
  };
  return (
    <section
      aria-label="課程篩選"
      className="grid gap-4 rounded-3xl bg-sage p-5 md:grid-cols-3"
    >
      <div>
        <Label htmlFor="date">開始日期</Label>
        <input
          id="date"
          className="mt-2 min-h-11 w-full rounded-xl border border-border bg-paper px-3"
          type="date"
          value={searchParams.get("startsAfter")?.slice(0, 10) ?? ""}
          onChange={(event) =>
            update(
              "startsAfter",
              event.target.value
                ? new Date(`${event.target.value}T00:00:00`).toISOString()
                : "",
            )
          }
        />
      </div>
      <div>
        <Label htmlFor="category">課程類型</Label>
        <select
          id="category"
          className="mt-2 min-h-11 w-full rounded-xl border border-border bg-paper px-3"
          value={searchParams.get("category") ?? ""}
          onChange={(event) => update("category", event.target.value)}
        >
          {categories.map((category) => (
            <option key={category} value={category}>
              {category || "所有類型"}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="level">難度</Label>
        <select
          id="level"
          className="mt-2 min-h-11 w-full rounded-xl border border-border bg-paper px-3"
          value={searchParams.get("level") ?? ""}
          onChange={(event) => update("level", event.target.value)}
        >
          {levels.map((level) => (
            <option key={level} value={level}>
              {level || "所有難度"}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}
