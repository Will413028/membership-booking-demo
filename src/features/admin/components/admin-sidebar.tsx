import Link from "next/link";

const links = [
  ["Dashboard", "/admin"],
  ["Schedules", "/admin/schedules"],
  ["Bookings", "/admin/bookings"],
  ["Members", "/admin/members"],
  ["Orders", "/admin/orders"],
] as const;

export function AdminSidebar({ email }: { email: string | null }) {
  return (
    <aside className="border-b border-border bg-paper lg:min-h-screen lg:w-64 lg:border-r lg:border-b-0">
      <div className="flex items-center justify-between gap-4 px-5 py-5 lg:block">
        <Link className="font-display text-xl font-bold" href="/">
          Motion Room
        </Link>
        <p className="mt-1 hidden text-xs font-bold uppercase tracking-[0.16em] text-coral lg:block">
          Admin operations
        </p>
      </div>
      <nav
        aria-label="Admin navigation"
        className="flex overflow-x-auto px-3 pb-4 lg:block lg:px-4"
      >
        {links.map(([label, href]) => (
          <Link
            className="whitespace-nowrap rounded-xl px-4 py-3 text-sm font-semibold text-ink hover:bg-sage lg:mb-1 lg:block"
            href={href}
            key={href}
          >
            {label}
          </Link>
        ))}
      </nav>
      <p className="hidden px-5 text-xs text-muted-foreground lg:block">
        {email ?? "Admin"}
      </p>
    </aside>
  );
}
