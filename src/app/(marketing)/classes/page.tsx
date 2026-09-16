import Link from "next/link";
import { ConfigurationError } from "@/components/shared/configuration-error";
import { SectionHeading } from "@/components/shared/section-heading";
import { ClassCard } from "@/features/classes/components/class-card";
import { ClassFilters } from "@/features/classes/components/class-filters";
import { listUpcomingSessions } from "@/features/classes/queries";
import { isConfigurationError } from "@/lib/errors/configuration";

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
      <section className="relative overflow-hidden bg-sage/25">
        <div
          aria-hidden="true"
          className="absolute -right-40 top-14 size-96 rounded-full bg-accent/30 blur-3xl"
        />
        <div className="page-shell relative space-y-10 py-16 md:py-24">
          <SectionHeading
            className="max-w-3xl"
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
            <div className="rounded-[1.75rem] border border-dashed border-border bg-paper/80 p-10 text-center shadow-sm">
              <h2 className="font-display text-2xl font-bold">
                目前沒有符合的課程
              </h2>
              <p className="mt-2 text-muted-foreground">
                換一個日期或篩選條件，再看看新的開放名額。
              </p>
              <Link
                className="mt-5 inline-flex rounded-full border border-ink px-4 py-2 font-semibold transition hover:-translate-y-0.5 hover:bg-sage focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coral"
                href="/classes"
              >
                清除篩選
              </Link>
            </div>
          )}
        </div>
      </section>
    );
  } catch (error) {
    if (isConfigurationError(error)) return <ConfigurationError />;
    return (
      <section className="page-shell py-20">
        <div
          role="alert"
          className="rounded-[1.75rem] border border-coral bg-paper p-8 shadow-sm"
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
