import { Input } from "@/components/ui/input";
import { BookingTable } from "@/features/admin/components/booking-table";
import { listAdminBookings } from "@/features/admin/queries";

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const { search } = await searchParams;
  const bookings = await listAdminBookings(search);
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-coral">
          Bookings
        </p>
        <h1 className="mt-2 font-display text-4xl font-bold">
          Member bookings
        </h1>
      </div>
      <form>
        <Input
          className="max-w-sm"
          defaultValue={search}
          name="search"
          placeholder="Search member, class or status"
        />
      </form>
      <BookingTable bookings={bookings} />
    </div>
  );
}
