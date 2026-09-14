import { Badge } from "@/components/ui/badge";
import { Table } from "@/components/ui/table";

import type { AdminMember } from "../types";

export function MemberTable({ members }: { members: AdminMember[] }) {
  if (!members.length)
    return (
      <p className="rounded-2xl bg-paper p-6 text-muted-foreground">
        No members match this search.
      </p>
    );
  return (
    <Table>
      <thead>
        <tr className="border-b border-border text-sm">
          <th className="p-3">Member</th>
          <th className="p-3">Membership</th>
          <th className="p-3">Credits</th>
          <th className="p-3">Period end</th>
        </tr>
      </thead>
      <tbody>
        {members.map((member) => (
          <tr
            data-testid={`member-${member.id}`}
            className="border-b border-border last:border-0"
            key={member.id}
          >
            <td className="p-3 font-semibold">{member.fullName}</td>
            <td className="p-3">
              {member.membershipStatus ? (
                <Badge>{member.membershipStatus}</Badge>
              ) : (
                "—"
              )}
            </td>
            <td className="p-3">{member.creditsRemaining ?? "Unlimited"}</td>
            <td className="p-3 text-sm">
              {member.currentPeriodEnd
                ? new Intl.DateTimeFormat("zh-TW", {
                    timeZone: "Asia/Taipei",
                    dateStyle: "medium",
                  }).format(new Date(member.currentPeriodEnd))
                : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
