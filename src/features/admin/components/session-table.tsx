"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table } from "@/components/ui/table";

import { setSessionActive } from "../actions";
import type { AdminSchedule } from "../types";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function SessionTable({ sessions }: { sessions: AdminSchedule[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const toggle = async (session: AdminSchedule) => {
    setPendingId(session.id);
    setMessage("");
    const result = await setSessionActive({
      sessionId: session.id,
      active: !session.active,
    });
    setPendingId(null);
    if (!result.ok) {
      setMessage("Session status could not be updated.");
      return;
    }
    router.refresh();
  };

  if (!sessions.length)
    return (
      <p className="rounded-2xl bg-paper p-6 text-muted-foreground">
        No sessions match these filters.
      </p>
    );
  return (
    <div className="space-y-3">
      {message && (
        <p aria-live="polite" className="text-sm text-coral">
          {message}
        </p>
      )}
      <Table>
        <thead>
          <tr className="border-b border-border text-sm">
            <th className="p-3">Session</th>
            <th className="p-3">When</th>
            <th className="p-3">Capacity</th>
            <th className="p-3">Status</th>
            <th className="p-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((session) => (
            <tr
              className="border-b border-border last:border-0"
              key={session.id}
            >
              <td className="p-3">
                <p className="font-semibold">{session.className}</p>
                <p className="text-sm text-muted-foreground">
                  {session.instructorName}
                </p>
              </td>
              <td className="p-3 text-sm">{formatDate(session.startsAt)}</td>
              <td className="p-3 text-sm">
                {session.confirmedCount} / {session.capacity}
              </td>
              <td className="p-3">
                <Badge
                  className={
                    session.active ? "" : "bg-border text-muted-foreground"
                  }
                >
                  {session.active ? "Active" : "Inactive"}
                </Badge>
              </td>
              <td className="p-3">
                <div className="flex gap-2">
                  <Link
                    className="rounded-full border border-ink px-3 py-2 text-sm font-semibold"
                    href={`/admin/schedules/${session.id}/edit`}
                  >
                    Edit
                  </Link>
                  <Button
                    disabled={pendingId === session.id}
                    onClick={() => toggle(session)}
                    size="sm"
                    variant="ghost"
                  >
                    {session.active ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      <p className="text-sm text-muted-foreground">
        Inactive sessions keep existing bookings and cannot accept new member
        bookings.
      </p>
    </div>
  );
}
