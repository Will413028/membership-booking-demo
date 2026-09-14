"use client";

import { Button } from "@/components/ui/button";

export default function MemberError({ reset }: { reset: () => void }) {
  return (
    <section className="page-shell py-20" role="alert">
      <h1 className="font-display text-3xl font-bold">會員資料暫時無法載入</h1>
      <p className="mt-3">請稍後重試。</p>
      <Button className="mt-6" onClick={reset}>
        重新載入
      </Button>
    </section>
  );
}
