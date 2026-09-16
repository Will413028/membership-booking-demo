import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { ClassSession } from "@/features/classes/types";
import { cn } from "@/lib/utils";

function formatStart(value: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function ClassCard({ session }: { session: ClassSession }) {
  const full = session.remainingSpots === 0;
  return (
    <Card className="group relative isolate flex h-full flex-col gap-5 overflow-hidden border-border/90 p-6 transition duration-300 hover:-translate-y-1 hover:border-olive/45 hover:shadow-[0_26px_55px_-36px_hsl(var(--ink))]">
      <div
        aria-hidden="true"
        className="absolute -right-14 -top-16 size-40 rounded-full bg-sage/45 blur-3xl transition-opacity duration-300 group-hover:opacity-80"
      />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-coral" />
            {formatStart(session.startsAt)}
          </p>
          <h3 className="mt-3 font-display text-2xl font-bold tracking-tight text-ink">
            {session.className}
          </h3>
        </div>
        <Badge className="border border-olive/10 bg-sage/65">{session.category}</Badge>
      </div>
      <div className="relative space-y-2 text-sm text-muted-foreground">
        <p>
          {session.instructorName} · {session.level}
        </p>
        <p
          className={cn(
            "flex items-center gap-2 font-semibold",
            full ? "text-coral" : "text-olive",
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "size-1.5 rounded-full",
              full ? "bg-coral" : "bg-olive",
            )}
          />
          {full ? "本堂已額滿" : `剩餘 ${session.remainingSpots} 個名額`}
        </p>
      </div>
      <Link
        aria-label={`查看 ${session.className} 課程`}
        className="group/link relative mt-auto inline-flex w-fit items-center gap-2 rounded-full border border-ink px-4 py-2 text-sm font-semibold text-ink transition hover:-translate-y-0.5 hover:bg-sage focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coral"
        href={`/classes/${session.id}`}
      >
        查看課程
        <ArrowUpRight
          aria-hidden="true"
          className="size-4 transition-transform duration-300 group-hover/link:-translate-y-0.5 group-hover/link:translate-x-0.5"
        />
      </Link>
    </Card>
  );
}
