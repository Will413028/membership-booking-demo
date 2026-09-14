import { Input } from "@/components/ui/input";
import { MemberTable } from "@/features/admin/components/member-table";
import { listAdminMembers } from "@/features/admin/queries";

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const { search } = await searchParams;
  const members = await listAdminMembers(search);
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-coral">
          Members
        </p>
        <h1 className="mt-2 font-display text-4xl font-bold">
          Member operations
        </h1>
      </div>
      <form>
        <Input
          className="max-w-sm"
          defaultValue={search}
          name="search"
          placeholder="Search member"
        />
      </form>
      <MemberTable members={members} />
    </div>
  );
}
