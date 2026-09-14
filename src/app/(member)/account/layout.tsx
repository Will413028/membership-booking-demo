import Link from "next/link";

import { requireAccountUser } from "@/lib/auth/account";

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAccountUser("/account");
  return (
    <div className="min-h-screen bg-sage">
      <header className="border-b border-border bg-paper">
        <nav
          aria-label="會員導覽"
          className="page-shell flex flex-wrap items-center justify-between gap-4 py-4"
        >
          <Link className="font-display text-xl font-bold" href="/">
            Motion Room
          </Link>
          <div className="flex gap-4 text-sm font-semibold">
            <Link href="/account">我的帳戶</Link>
            <Link href="/account/bookings">預約</Link>
            <Link href="/account/orders">訂單</Link>
          </div>
          <span className="text-sm text-muted-foreground">
            {user.email ?? "會員"}
          </span>
        </nav>
      </header>
      <main className="page-shell py-10 md:py-14">{children}</main>
    </div>
  );
}
