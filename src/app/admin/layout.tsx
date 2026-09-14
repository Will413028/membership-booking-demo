import { AdminSidebar } from "@/features/admin/components/admin-sidebar";
import { requireAdmin } from "@/lib/auth/guards";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();
  return (
    <div className="min-h-screen bg-sage lg:flex">
      <AdminSidebar email={admin.email} />
      <main className="min-w-0 flex-1 p-5 md:p-8 lg:p-10">{children}</main>
    </div>
  );
}
