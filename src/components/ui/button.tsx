import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm";
};

export function Button({
  className,
  variant = "default",
  size = "default",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coral disabled:pointer-events-none disabled:opacity-60",
        variant === "default" && "bg-ink px-5 py-3 text-paper hover:bg-olive",
        variant === "outline" &&
          "border border-ink bg-transparent px-5 py-3 text-ink hover:bg-sage",
        variant === "ghost" && "px-3 py-2 text-ink hover:bg-sage",
        size === "sm" && "px-3 py-2 text-sm",
        className,
      )}
      type={type}
      {...props}
    />
  );
}
