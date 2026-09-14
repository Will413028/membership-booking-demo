import Link from "next/link";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { SectionHeading } from "@/components/shared/section-heading";

const highlights = [
  ["Starter 8", "每月 8 堂，留給穩定的練習。"],
  ["Unlimited", "讓身體自在探索每一種流動。"],
  ["Single Class", "先來一堂，感受你的節奏。"],
];

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main className="marketing-main">
        <section className="page-shell grid gap-10 py-16 md:grid-cols-[1.2fr_.8fr] md:py-28">
          <div className="space-y-7">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-coral">
              Pilates · Yoga · Mobility
            </p>
            <h1 className="font-display text-5xl font-bold tracking-tight text-ink md:text-7xl">
              Make space for movement
            </h1>
            <p className="max-w-xl text-lg leading-8 text-muted-foreground">
              在 Motion Room，用一堂課回到身體，也回到你自己的節奏。
            </p>
            <Link
              aria-label="Book a class"
              className="inline-flex rounded-full bg-ink px-6 py-3 font-semibold text-paper hover:bg-olive focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coral"
              href="/classes"
            >
              預約課程
            </Link>
          </div>
          <div className="rounded-[2rem] bg-olive p-8 text-paper md:rotate-2">
            <p className="text-sm text-paper/70">找到你的練習節奏</p>
            <p className="mt-8 font-display text-6xl font-bold">Move</p>
            <p className="mt-2 text-paper/80">
              伸展、呼吸、重新對齊。即時名額請查看課表。
            </p>
          </div>
        </section>
        <section className="bg-sage">
          <div className="page-shell py-16">
            <SectionHeading
              eyebrow="Today’s openings"
              title="今天，為自己留一個位置"
            />
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {[
                "晨間 Flow Yoga",
                "Reformer Foundations",
                "Evening Stretch",
              ].map((name) => (
                <Link
                  key={name}
                  href="/classes"
                  className="rounded-3xl bg-paper p-6 font-display text-2xl font-bold shadow-sm hover:-translate-y-1"
                >
                  {name}
                  <span className="mt-5 block font-sans text-sm font-semibold text-olive">
                    查看開放名額 →
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
        <section className="page-shell py-16 md:py-24">
          <SectionHeading
            eyebrow="Simple membership"
            title="依照你的生活，選擇練習的份量"
          />
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {highlights.map(([name, copy]) => (
              <div
                key={name}
                className="rounded-3xl border border-border bg-paper p-6"
              >
                <h2 className="font-display text-2xl font-bold">{name}</h2>
                <p className="mt-3 text-muted-foreground">{copy}</p>
                <Link
                  className="mt-5 inline-block text-sm font-bold"
                  href="/plans"
                >
                  查看方案 →
                </Link>
              </div>
            ))}
          </div>
        </section>
        <section className="bg-ink text-paper">
          <div className="page-shell py-16">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-coral">
              Our studio
            </p>
            <h2 className="mt-4 max-w-3xl font-display text-4xl font-bold md:text-6xl">
              不是追求更多，而是把每一次移動做得更貼近自己。
            </h2>
            <p className="mt-6 max-w-2xl leading-8 text-paper/70">
              小班制、細緻引導、安靜卻有力量的空間。每個程度，都有被好好照顧的位置。
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
