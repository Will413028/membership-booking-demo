import Link from "next/link";
import { SectionHeading } from "@/components/shared/section-heading";
import { ClassCard } from "@/features/classes/components/class-card";
import { ClassFilters } from "@/features/classes/components/class-filters";
import { listUpcomingSessions } from "@/features/classes/queries";

type Search = {
  category?: string;
  level?: string;
  startsAfter?: string;
  startsBefore?: string;
};

export default async function ClassesPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const filters = await searchParams;
  try {
    const sessions = await listUpcomingSessions(filters);
    return (
      <section className="page-shell space-y-10 py-12 md:py-20">
        <SectionHeading
          eyebrow="Class schedule"
          title="找一堂適合今天的課"
          description="用日期、類型與難度篩選，分享網址就能重現相同課表。"
        />
        <ClassFilters />
        {sessions.length ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {sessions.map((session) => (
              <ClassCard key={session.id} session={session} />
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-border bg-paper p-10 text-center">
            <h2 className="font-display text-2xl font-bold">
              目前沒有符合的課程
            </h2>
            <p className="mt-2 text-muted-foreground">
              換一個日期或篩選條件，再看看新的開放名額。
            </p>
            <Link
              className="mt-5 inline-flex rounded-full border border-ink px-4 py-2 font-semibold"
              href="/classes"
            >
              清除篩選
            </Link>
          </div>
        )}
      </section>
    );
  } catch {
    return (
      <section className="page-shell py-20">
        <div
          role="alert"
          className="rounded-3xl border border-coral bg-paper p-8"
        >
          <h1 className="font-display text-3xl font-bold">課表暫時無法載入</h1>
          <p className="mt-3 text-muted-foreground">
            請稍後再試；你的篩選條件不會被變更。
          </p>
        </div>
      </section>
    );
  }
}
