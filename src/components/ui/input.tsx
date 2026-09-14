import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "min-h-11 w-full rounded-xl border border-border bg-paper px-3 text-ink outline-none transition placeholder:text-muted-foreground focus:border-olive focus:ring-2 focus:ring-sage",
        className,
      )}
      {...props}
    />
  );
}
