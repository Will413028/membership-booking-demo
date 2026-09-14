import { SessionForm } from "@/features/admin/components/session-form";
import { listAdminClasses } from "@/features/admin/queries";

export default async function NewSchedulePage() {
  const classes = await listAdminClasses({ mode: "new" });
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-coral">
          Schedules
        </p>
        <h1 className="mt-2 font-display text-4xl font-bold">New session</h1>
      </div>
      {classes.length ? (
        <SessionForm classes={classes} />
      ) : (
        <p className="rounded-2xl bg-paper p-6 text-muted-foreground">
          Create an active class before adding a session.
        </p>
      )}
    </div>
  );
}
