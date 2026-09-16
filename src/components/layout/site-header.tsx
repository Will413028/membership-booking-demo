import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-paper/80 backdrop-blur-xl">
      <nav
        aria-label="主要導覽"
        className="page-shell flex min-h-18 items-center justify-between gap-4"
      >
        <Link
          className="group inline-flex shrink-0 items-center gap-3 whitespace-nowrap rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coral"
          href="/"
        >
          <span className="flex size-9 items-center justify-center rounded-xl bg-ink font-display text-sm font-bold tracking-tight text-paper transition duration-300 group-hover:rotate-3 group-hover:bg-olive">
            MR
          </span>
          <span className="font-display text-base font-bold tracking-[-0.03em] text-ink sm:text-xl">
            Motion / Room
          </span>
        </Link>
        <div className="flex shrink-0 items-center gap-1 rounded-full border border-border/80 bg-paper/65 p-1 text-sm font-semibold shadow-sm backdrop-blur-sm">
          <Link
            className="whitespace-nowrap rounded-full px-2.5 py-2 text-muted-foreground transition hover:bg-sage/60 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral sm:px-4"
            href="/classes"
          >
            課程
          </Link>
          <Link
            className="whitespace-nowrap rounded-full px-2.5 py-2 text-muted-foreground transition hover:bg-sage/60 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral sm:px-4"
            href="/plans"
          >
            方案
          </Link>
          <Link
            className="group inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-ink px-2.5 py-2 text-paper transition hover:bg-olive focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral sm:px-4"
            href="/login"
          >
            登入
            <ArrowUpRight
              aria-hidden="true"
              className="size-3.5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            />
          </Link>
        </div>
      </nav>
    </header>
  );
}
