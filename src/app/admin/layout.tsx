import { redirect } from "next/navigation";

import { ConfigurationError } from "@/components/shared/configuration-error";
import { AdminSidebar } from "@/features/admin/components/admin-sidebar";
import { requireAdmin } from "@/lib/auth/guards";
import type { SessionUser } from "@/lib/auth/types";
import { isConfigurationError } from "@/lib/errors/configuration";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let admin: SessionUser;
  try {
    admin = await requireAdmin();
  } catch (error) {
    if (isConfigurationError(error)) return <ConfigurationError />;
    redirect("/account");
  }
  return (
    <div className="min-h-screen bg-sage lg:flex">
      <AdminSidebar email={admin.email} />
      <main className="min-w-0 flex-1 p-5 md:p-8 lg:p-10">{children}</main>
    </div>
  );
}
