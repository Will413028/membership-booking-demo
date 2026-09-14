"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { createBooking } from "../actions";

export function BookingButton({
  sessionId,
  full,
}: {
  sessionId: string;
  full: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);

  const book = () => {
    startTransition(async () => {
      setNotice(null);
      const result = await createBooking({ sessionId });
      if (result.ok) {
        setNotice("預約已確認");
        router.refresh();
        return;
      }
      setNotice(result.message);
    });
  };

  return (
    <div className="mt-8">
      <Button disabled={full || pending} onClick={book} type="button">
        {full ? "本堂已額滿" : pending ? "預約處理中…" : "預約這堂課"}
      </Button>
      {notice ? (
        <p aria-live="polite" className="mt-3 text-sm text-olive">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
