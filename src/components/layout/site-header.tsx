import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-border bg-paper/95">
      <nav
        aria-label="主要導覽"
        className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 md:px-8"
      >
        <Link
          className="font-display text-xl font-bold tracking-tight text-ink"
          href="/"
        >
          Motion Room
        </Link>
        <div className="flex items-center gap-4 text-sm font-semibold">
          <Link href="/classes">課程</Link>
          <Link href="/plans">方案</Link>
          <Link href="/login">登入</Link>
        </div>
      </nav>
    </header>
  );
}
