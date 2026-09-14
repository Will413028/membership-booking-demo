import Link from "next/link";

import { Input } from "@/components/ui/input";
import { SessionTable } from "@/features/admin/components/session-table";
import { listAdminSchedules } from "@/features/admin/queries";

export default async function SchedulesPage({
  searchParams,
}: {
  searchParams: Promise<{ active?: "active" | "inactive"; search?: string }>;
}) {
  const params = await searchParams;
  const sessions = await listAdminSchedules(params);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-coral">
            Schedules
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold">
            Class sessions
          </h1>
        </div>
        <Link
          className="rounded-full bg-ink px-5 py-3 font-semibold text-paper"
          href="/admin/schedules/new"
        >
          New session
        </Link>
      </div>
      <form className="flex flex-wrap gap-3">
        <Input
          className="max-w-xs"
          defaultValue={params.search}
          name="search"
          placeholder="Search class or instructor"
        />
        <select
          className="min-h-11 rounded-xl border border-border bg-paper px-3"
          defaultValue={params.active ?? ""}
          name="active"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <button
          className="rounded-full border border-ink px-4 py-2 text-sm font-semibold"
          type="submit"
        >
          Filter
        </button>
      </form>
      <SessionTable sessions={sessions} />
    </div>
  );
}
