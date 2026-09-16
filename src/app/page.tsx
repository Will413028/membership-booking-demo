import { ArrowRight, ArrowUpRight, CalendarDays, Sparkles } from "lucide-react";
import Link from "next/link";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Reveal } from "@/components/motion/reveal";
import { SectionHeading } from "@/components/shared/section-heading";
import { BlurFade } from "@/components/visual/blur-fade";
import { Spotlight } from "@/components/visual/spotlight";

const openings = [
  {
    name: "晨間 Flow Yoga",
    detail: "呼吸 · 柔軟度",
  },
  {
    name: "Reformer Foundations",
    detail: "核心 · 對齊",
  },
  {
    name: "Evening Stretch",
    detail: "放鬆 · 修復",
  },
];

const highlights = [
  {
    name: "Starter 8",
    label: "穩定練習",
    copy: "每月 8 堂，留給穩定的練習。",
  },
  {
    name: "Unlimited",
    label: "自由探索",
    copy: "讓身體自在探索每一種流動。",
  },
  {
    name: "Single Class",
    label: "先來一堂",
    copy: "先來一堂，感受你的節奏。",
  },
];

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main className="marketing-main">
        <section
          aria-labelledby="hero-title"
          className="relative isolate overflow-hidden border-b border-border/70"
        >
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,hsl(var(--accent)/.5),transparent_34%),radial-gradient(circle_at_92%_12%,hsl(var(--sage)/.42),transparent_28%)]"
          />
          <Spotlight
            className="left-[76%] top-[10%] h-[90%] w-[85%]"
            fill="hsl(var(--accent))"
          />
          <div className="page-shell relative grid gap-14 py-16 sm:py-20 md:grid-cols-[1.05fr_.95fr] md:items-center md:gap-10 md:py-28 lg:py-32">
            <BlurFade className="relative z-10 space-y-8" delay={0.05}>
              <div className="space-y-5">
                <p className="inline-flex items-center gap-2 rounded-full border border-olive/20 bg-paper/70 px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-olive shadow-sm backdrop-blur-sm">
                  <span
                    aria-hidden="true"
                    className="size-1.5 rounded-full bg-coral"
                  />
                  Pilates · Yoga · Mobility
                </p>
                <h1
                  id="hero-title"
                  className="max-w-3xl font-display text-[3.65rem] font-bold leading-[0.96] tracking-[-0.055em] text-ink sm:text-6xl md:text-7xl lg:text-[5.7rem]"
                >
                  Make space{" "}
                  <span className="block text-olive">for movement.</span>
                </h1>
                <p className="max-w-xl text-lg leading-8 text-muted-foreground sm:text-xl">
                  在 Motion Room，用一堂課回到身體，也回到你自己的節奏。
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  aria-label="Book a class"
                  className="group inline-flex items-center gap-3 rounded-full bg-ink px-5 py-3.5 font-semibold text-paper shadow-[0_14px_30px_-18px_hsl(var(--ink))] transition duration-300 hover:-translate-y-0.5 hover:bg-olive focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coral"
                  href="/classes"
                >
                  預約課程
                  <ArrowUpRight
                    aria-hidden="true"
                    className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  />
                </Link>
                <Link
                  className="group inline-flex items-center gap-2 rounded-full border border-ink/20 bg-paper/55 px-5 py-3.5 font-semibold text-ink transition duration-300 hover:-translate-y-0.5 hover:border-olive hover:bg-paper focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coral"
                  href="/plans"
                >
                  探索會員方案
                  <ArrowRight
                    aria-hidden="true"
                    className="size-4 transition-transform duration-300 group-hover:translate-x-1"
                  />
                </Link>
              </div>
              <div className="flex flex-wrap gap-x-8 gap-y-4 border-t border-border/80 pt-6 text-sm">
                <div>
                  <p className="font-display text-2xl font-bold text-ink">3</p>
                  <p className="mt-1 text-muted-foreground">種練習方式</p>
                </div>
                <div>
                  <p className="font-display text-2xl font-bold text-ink">
                    小班制
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    細緻引導每一次移動
                  </p>
                </div>
                <div>
                  <p className="font-display text-2xl font-bold text-ink">
                    Taipei
                  </p>
                  <p className="mt-1 text-muted-foreground">為生活留白</p>
                </div>
              </div>
            </BlurFade>

            <BlurFade
              className="relative z-10 mx-auto w-full max-w-md md:max-w-none"
              delay={0.18}
            >
              <div className="relative px-3 pb-8 pt-3 sm:px-8 md:px-0 md:pb-10">
                <div
                  aria-hidden="true"
                  className="absolute inset-x-9 bottom-1 top-10 rounded-[2.5rem] border border-olive/20 bg-sage/35 blur-sm"
                />
                <div className="relative overflow-hidden rounded-[2.25rem] border border-paper/20 bg-ink p-2 shadow-[0_32px_70px_-28px_hsl(var(--ink))] md:rotate-2">
                  <div className="relative flex min-h-[27rem] flex-col justify-between overflow-hidden rounded-[1.75rem] border border-paper/10 bg-[radial-gradient(circle_at_75%_22%,hsl(var(--sage)/.42),transparent_24%),linear-gradient(145deg,hsl(var(--olive)),hsl(var(--ink))_72%)] p-7 text-paper sm:min-h-[32rem] sm:p-9">
                    <div
                      aria-hidden="true"
                      className="absolute -right-24 -top-24 size-72 rounded-full border border-paper/15 bg-sage/10 blur-2xl"
                    />
                    <div className="relative flex items-center justify-between text-xs font-bold uppercase tracking-[0.18em] text-paper/65">
                      <span>Motion / Room</span>
                      <span>Quiet modern</span>
                    </div>
                    <div className="relative space-y-5">
                      <div
                        aria-hidden="true"
                        className="flex size-14 items-center justify-center rounded-2xl border border-paper/20 bg-paper/10"
                      >
                        <Sparkles className="size-6 text-sage" />
                      </div>
                      <div>
                        <p className="font-display text-5xl font-bold leading-none tracking-[-0.05em] sm:text-6xl">
                          Return
                        </p>
                        <p className="mt-2 font-display text-5xl font-bold leading-none tracking-[-0.05em] text-sage sm:text-6xl">
                          to your body.
                        </p>
                      </div>
                      <p className="max-w-xs text-sm leading-7 text-paper/70">
                        伸展、呼吸、重新對齊。把練習帶回每天的生活裡。
                      </p>
                    </div>
                    <div className="relative flex items-end justify-between border-t border-paper/15 pt-5 text-xs text-paper/60">
                      <span>01 — 03</span>
                      <span className="flex items-center gap-2">
                        Taipei studio
                        <span
                          aria-hidden="true"
                          className="size-1.5 rounded-full bg-coral"
                        />
                      </span>
                    </div>
                  </div>
                </div>
                <div className="absolute -bottom-1 left-0 flex items-center gap-3 rounded-2xl border border-border/80 bg-paper px-4 py-3 shadow-[0_18px_35px_-24px_hsl(var(--ink))] sm:left-3">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-sage text-olive">
                    <CalendarDays aria-hidden="true" className="size-4" />
                  </span>
                  <span>
                    <span className="block text-[0.65rem] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                      Start here
                    </span>
                    <span className="block text-sm font-semibold text-ink">
                      預約從一堂開始
                    </span>
                  </span>
                </div>
              </div>
            </BlurFade>
          </div>
        </section>

        <section className="relative overflow-hidden bg-sage/55">
          <div className="page-shell py-16 sm:py-20 md:py-24">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <Reveal>
                <SectionHeading
                  description="從今天開始，找到一堂適合你當下狀態的課。"
                  eyebrow="Today’s openings"
                  title="今天，為自己留一個位置"
                />
              </Reveal>
              <Link
                className="group inline-flex w-fit items-center gap-2 text-sm font-bold text-olive transition hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coral"
                href="/classes"
              >
                查看完整課表
                <ArrowRight
                  aria-hidden="true"
                  className="size-4 transition-transform duration-300 group-hover:translate-x-1"
                />
              </Link>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {openings.map((opening, index) => (
                <BlurFade key={opening.name} delay={0.08 + index * 0.08}>
                  <Link
                    className="group flex min-h-44 flex-col justify-between rounded-[1.75rem] border border-paper/80 bg-paper/80 p-6 shadow-[0_18px_35px_-30px_hsl(var(--ink))] transition duration-300 hover:-translate-y-1 hover:bg-paper hover:shadow-[0_24px_45px_-30px_hsl(var(--ink))] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coral"
                    href="/classes"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <span className="font-display text-3xl font-bold text-olive/45">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <ArrowUpRight
                        aria-hidden="true"
                        className="size-5 text-muted-foreground transition duration-300 group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-olive"
                      />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-coral">
                        {opening.detail}
                      </p>
                      <h3 className="mt-2 font-display text-2xl font-bold tracking-tight text-ink">
                        {opening.name}
                      </h3>
                    </div>
                  </Link>
                </BlurFade>
              ))}
            </div>
          </div>
        </section>

        <section id="membership" className="page-shell py-16 sm:py-20 md:py-28">
          <Reveal>
            <SectionHeading
              description="不需要一次決定全部，先從適合現在的份量開始。"
              eyebrow="Simple membership"
              title="依照你的生活，選擇練習的份量"
            />
          </Reveal>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {highlights.map((highlight, index) => (
              <BlurFade key={highlight.name} delay={0.08 + index * 0.08}>
                <article className="group flex h-full min-h-64 flex-col rounded-[1.75rem] border border-border bg-paper p-6 transition duration-300 hover:-translate-y-1 hover:border-olive/45 hover:shadow-[0_24px_50px_-35px_hsl(var(--ink))]">
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-sage/65 px-3 py-1 text-xs font-bold uppercase tracking-[0.15em] text-olive">
                      {highlight.label}
                    </span>
                    <span className="font-display text-2xl font-bold text-olive/40">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h3 className="mt-10 font-display text-3xl font-bold tracking-tight text-ink">
                    {highlight.name}
                  </h3>
                  <p className="mt-3 leading-7 text-muted-foreground">
                    {highlight.copy}
                  </p>
                  <Link
                    className="group/link mt-auto inline-flex w-fit items-center gap-2 pt-7 text-sm font-bold text-olive transition hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coral"
                    href="/plans"
                  >
                    查看方案
                    <ArrowRight
                      aria-hidden="true"
                      className="size-4 transition-transform duration-300 group-hover/link:translate-x-1"
                    />
                  </Link>
                </article>
              </BlurFade>
            ))}
          </div>
          <div className="mt-8 flex flex-col gap-4 rounded-[1.75rem] border border-olive/15 bg-sage/35 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-coral">
                Find your rhythm
              </p>
              <p className="mt-2 font-display text-2xl font-bold text-ink">
                先看看完整方案，再決定你的練習節奏。
              </p>
            </div>
            <Link
              className="group inline-flex w-fit shrink-0 items-center gap-2 rounded-full bg-olive px-5 py-3 font-semibold text-paper transition duration-300 hover:-translate-y-0.5 hover:bg-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coral"
              href="/plans"
            >
              探索會員方案
              <ArrowUpRight
                aria-hidden="true"
                className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              />
            </Link>
          </div>
        </section>

        <section className="relative overflow-hidden bg-ink text-paper">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(circle_at_85%_25%,hsl(var(--olive)/.8),transparent_32%),linear-gradient(120deg,transparent_0%,hsl(var(--paper)/.04)_48%,transparent_100%)]"
          />
          <div className="page-shell relative py-16 sm:py-20 md:py-24">
            <Reveal>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-coral">
                Our studio
              </p>
              <h2 className="mt-5 max-w-3xl font-display text-4xl font-bold leading-[1.05] tracking-[-0.04em] sm:text-5xl md:text-6xl">
                不是追求更多，而是把每一次移動做得更貼近自己。
              </h2>
              <p className="mt-6 max-w-2xl leading-8 text-paper/70">
                小班制、細緻引導、安靜卻有力量的空間。每個程度，都有被好好照顧的位置。
              </p>
              <Link
                className="group mt-8 inline-flex items-center gap-2 rounded-full border border-paper/25 px-5 py-3 font-semibold text-paper transition duration-300 hover:-translate-y-0.5 hover:border-paper/60 hover:bg-paper/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coral"
                href="/classes"
              >
                進入課表
                <ArrowUpRight
                  aria-hidden="true"
                  className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                />
              </Link>
            </Reveal>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
