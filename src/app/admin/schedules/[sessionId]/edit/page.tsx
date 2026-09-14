import { notFound } from "next/navigation";

import { SessionForm } from "@/features/admin/components/session-form";
import { getAdminSession, listAdminClasses } from "@/features/admin/queries";

export default async function EditSchedulePage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const session = await getAdminSession(sessionId);
  if (!session) notFound();
  const classes = await listAdminClasses({
    mode: "edit",
    includeInactiveClassId: session.classId,
  });
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-coral">
          Schedules
        </p>
        <h1 className="mt-2 font-display text-4xl font-bold">Edit session</h1>
      </div>
      <SessionForm classes={classes} session={session} />
    </div>
  );
}
