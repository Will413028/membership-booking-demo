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
      className="grid gap-5 rounded-[1.75rem] border border-olive/15 bg-paper/70 p-5 shadow-[0_18px_40px_-32px_hsl(var(--ink))] backdrop-blur-sm md:grid-cols-3 md:p-6"
    >
      <div>
        <Label
          className="text-xs font-bold uppercase tracking-[0.16em] text-olive"
          htmlFor="date"
        >
          開始日期
        </Label>
        <input
          id="date"
          className="mt-2 min-h-11 w-full rounded-xl border border-border bg-paper/80 px-3 text-ink shadow-sm outline-none transition focus:border-olive focus:ring-2 focus:ring-olive/20"
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
        <Label
          className="text-xs font-bold uppercase tracking-[0.16em] text-olive"
          htmlFor="category"
        >
          課程類型
        </Label>
        <select
          id="category"
          className="mt-2 min-h-11 w-full rounded-xl border border-border bg-paper/80 px-3 text-ink shadow-sm outline-none transition focus:border-olive focus:ring-2 focus:ring-olive/20"
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
        <Label
          className="text-xs font-bold uppercase tracking-[0.16em] text-olive"
          htmlFor="level"
        >
          難度
        </Label>
        <select
          id="level"
          className="mt-2 min-h-11 w-full rounded-xl border border-border bg-paper/80 px-3 text-ink shadow-sm outline-none transition focus:border-olive focus:ring-2 focus:ring-olive/20"
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
