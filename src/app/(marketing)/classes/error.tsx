"use client";

import { Button } from "@/components/ui/button";

export default function ClassesError({ reset }: { reset: () => void }) {
  return (
    <section className="page-shell py-20">
      <div
        role="alert"
        className="rounded-3xl border border-coral bg-paper p-8"
      >
        <h1 className="font-display text-3xl font-bold">課表暫時無法載入</h1>
        <p className="mt-3 text-muted-foreground">請稍後重試。</p>
        <Button className="mt-6" onClick={reset}>
          重新載入
        </Button>
      </div>
    </section>
  );
}
