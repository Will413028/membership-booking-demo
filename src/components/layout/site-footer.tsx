import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-sage">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-10 text-sm md:flex-row md:items-center md:justify-between md:px-8">
        <p className="font-display text-lg font-bold">Motion Room</p>
        <p className="text-muted-foreground">為每一段身體節奏，留一個位置。</p>
        <Link href="/classes">查看課表</Link>
      </div>
    </footer>
  );
}
