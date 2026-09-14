"use client";

import { Button } from "@/components/ui/button";

export default function AdminError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-3xl bg-paper p-8">
      <p className="text-sm font-bold uppercase tracking-[0.16em] text-coral">
        Admin error
      </p>
      <h1 className="mt-2 font-display text-3xl font-bold">
        We could not load this operations view.
      </h1>
      <Button className="mt-6" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
