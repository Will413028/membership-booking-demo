import Link from "next/link";
import { notFound } from "next/navigation";

import { ConfigurationError } from "@/components/shared/configuration-error";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { BookingButton } from "@/features/bookings/components/booking-button";
import { getSessionDetails } from "@/features/classes/queries";
import type { ClassSessionDetails } from "@/features/classes/types";
import { getCurrentUser } from "@/lib/auth/guards";
import type { SessionUser } from "@/lib/auth/types";
import { isConfigurationError } from "@/lib/errors/configuration";

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  let session: ClassSessionDetails | null;
  let user: SessionUser | null;
  try {
    [session, user] = await Promise.all([
      getSessionDetails(classId),
      getCurrentUser(),
    ]);
  } catch (error) {
    if (isConfigurationError(error)) return <ConfigurationError />;
    throw error;
  }
  if (!session) notFound();
  const start = new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(session.startsAt));
  const full = session.remainingSpots === 0;
  return (
    <section className="page-shell py-12 md:py-20">
      <Link className="text-sm font-semibold" href="/classes">
        ← 回到課表
      </Link>
      <Card className="mt-7 max-w-3xl p-7 md:p-10">
        <Badge>
          {session.category} · {session.level}
        </Badge>
        <h1 className="mt-5 font-display text-4xl font-bold md:text-6xl">
          {session.className}
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
          {session.description}
        </p>
        <dl className="mt-9 grid gap-5 border-y border-border py-6 sm:grid-cols-3">
          <div>
            <dt className="text-sm text-muted-foreground">時間</dt>
            <dd className="mt-1 font-semibold">{start}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">老師</dt>
            <dd className="mt-1 font-semibold">{session.instructorName}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">名額</dt>
            <dd
              className={
                full
                  ? "mt-1 font-semibold text-coral"
                  : "mt-1 font-semibold text-olive"
              }
            >
              {full ? "本堂已額滿" : `剩餘 ${session.remainingSpots} 個名額`}
            </dd>
          </div>
        </dl>
        {user ? (
          <BookingButton full={full} sessionId={session.id} />
        ) : (
          <Link
            className="mt-8 inline-flex rounded-full bg-ink px-5 py-3 font-semibold text-paper hover:bg-olive focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coral"
            href={`/login?next=/classes/${classId}`}
          >
            {full ? "查看其他課程" : "登入後預約"}
          </Link>
        )}
      </Card>
    </section>
  );
}
