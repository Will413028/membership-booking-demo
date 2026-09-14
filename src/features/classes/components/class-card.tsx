import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { ClassSession } from "@/features/classes/types";

function formatStart(value: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function ClassCard({ session }: { session: ClassSession }) {
  const full = session.remainingSpots === 0;
  return (
    <Card className="flex h-full flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            {formatStart(session.startsAt)}
          </p>
          <h3 className="mt-2 font-display text-2xl font-bold">
            {session.className}
          </h3>
        </div>
        <Badge>{session.category}</Badge>
      </div>
      <div className="space-y-1 text-sm text-muted-foreground">
        <p>
          {session.instructorName} · {session.level}
        </p>
        <p
          className={
            full ? "font-semibold text-coral" : "font-semibold text-olive"
          }
        >
          {full ? "本堂已額滿" : `剩餘 ${session.remainingSpots} 個名額`}
        </p>
      </div>
      <Link
        aria-label={`查看 ${session.className} 課程`}
        className="mt-auto inline-flex w-fit rounded-full border border-ink px-4 py-2 text-sm font-semibold text-ink hover:bg-sage focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coral"
        href={`/classes/${session.id}`}
      >
        查看課程
      </Link>
    </Card>
  );
}
