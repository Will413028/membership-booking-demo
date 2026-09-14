import { Input } from "@/components/ui/input";
import { OrderTable } from "@/features/admin/components/order-table";
import { listAdminOrders } from "@/features/admin/queries";

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const { search } = await searchParams;
  const orders = await listAdminOrders(search);
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-coral">
          Orders
        </p>
        <h1 className="mt-2 font-display text-4xl font-bold">
          Order operations
        </h1>
      </div>
      <form>
        <Input
          className="max-w-sm"
          defaultValue={search}
          name="search"
          placeholder="Search member, plan or status"
        />
      </form>
      <OrderTable orders={orders} />
    </div>
  );
}
