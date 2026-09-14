import type { LabelHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Label({
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: Consumers pass htmlFor to associate this primitive with their input.
    <label
      className={cn("text-sm font-semibold text-ink", className)}
      {...props}
    />
  );
}
