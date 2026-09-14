import { Card } from "@/components/ui/card";
import { Table } from "@/components/ui/table";
import { MetricCard } from "@/features/admin/components/metric-card";
import { getAdminDashboard } from "@/features/admin/queries";

function date(value: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    weekday: "short",
    month: "numeric",
    day: "numeric",
  }).format(new Date(value));
}

export default async function AdminDashboardPage() {
  const data = await getAdminDashboard();
  const occupancyCapacity = data.capacitySummary.reduce(
    (total, day) => total + day.capacity,
    0,
  );
  const occupancyBookings = data.capacitySummary.reduce(
    (total, day) => total + day.confirmedCount,
    0,
  );
  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-coral">
          Admin dashboard
        </p>
        <h1 className="mt-2 font-display text-4xl font-bold">
          Operations at a glance
        </h1>
      </div>
      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          detail="Paid orders"
          label="Revenue"
          value={`NT$${(data.revenueTwdCents / 100).toLocaleString("zh-TW")}`}
        />
        <MetricCard
          detail="Current profiles"
          label="Active members"
          value={String(data.activeMemberCount)}
        />
        <MetricCard
          detail="Confirmed sessions today"
          label="Today bookings"
          value={String(data.todayBookingCount)}
        />
        <MetricCard
          detail="Confirmed seats / next 7 days"
          label="Occupancy"
          value={
            occupancyCapacity
              ? `${Math.round((occupancyBookings / occupancyCapacity) * 100)}%`
              : "—"
          }
        />
      </section>
      <section className="grid gap-6 xl:grid-cols-[.9fr_1.1fr]">
        <Card>
          <h2 className="font-display text-2xl font-bold">
            Seven-day occupancy
          </h2>
          <div className="mt-5 space-y-4">
            {data.capacitySummary.map((day) => (
              <div key={day.date}>
                <div className="flex justify-between gap-4 text-sm">
                  <span className="font-semibold">{date(day.date)}</span>
                  <span>
                    {day.confirmedCount} / {day.capacity || "—"}
                  </span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-sage">
                  <div
                    className="h-full rounded-full bg-olive"
                    style={{
                      width: `${day.capacity ? Math.min((day.confirmedCount / day.capacity) * 100, 100) : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="font-display text-2xl font-bold">Next sessions</h2>
          {data.nextSessions.length ? (
            <Table className="mt-5">
              <thead>
                <tr className="border-b border-border text-sm">
                  <th className="p-2">Class</th>
                  <th className="p-2">Time</th>
                  <th className="p-2">Seats</th>
                </tr>
              </thead>
              <tbody>
                {data.nextSessions.map((session) => (
                  <tr
                    className="border-b border-border last:border-0"
                    key={session.id}
                  >
                    <td className="p-2 font-semibold">{session.className}</td>
                    <td className="p-2 text-sm">
                      {new Intl.DateTimeFormat("zh-TW", {
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(new Date(session.startsAt))}
                    </td>
                    <td className="p-2 text-sm">
                      {session.confirmedCount}/{session.capacity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <p className="mt-5 text-muted-foreground">No upcoming sessions.</p>
          )}
        </Card>
      </section>
    </div>
  );
}
