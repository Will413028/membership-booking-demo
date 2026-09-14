import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Badge({
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full bg-sage px-3 py-1 text-xs font-bold tracking-wide text-olive",
        className,
      )}
      {...props}
    />
  );
}
