import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-sage/30">
      <div className="page-shell grid gap-8 py-10 text-sm md:grid-cols-[1fr_auto_auto] md:items-end md:gap-12 md:py-12">
        <div>
          <p className="font-display text-2xl font-bold tracking-[-0.04em] text-ink">
            Motion / Room
          </p>
          <p className="mt-2 max-w-xs leading-6 text-muted-foreground">
            為每一段身體節奏，留一個位置。
          </p>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 font-semibold text-olive">
          <Link
            className="transition hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coral"
            href="/classes"
          >
            課程
          </Link>
          <Link
            className="transition hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coral"
            href="/plans"
          >
            方案
          </Link>
          <Link
            className="transition hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coral"
            href="/login"
          >
            登入
          </Link>
        </div>
        <Link
          className="group inline-flex w-fit items-center gap-2 font-semibold text-ink transition hover:text-olive focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coral"
          href="/classes"
        >
          查看課表
          <ArrowUpRight
            aria-hidden="true"
            className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
          />
        </Link>
      </div>
    </footer>
  );
}
