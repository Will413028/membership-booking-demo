import { cn } from "@/lib/utils";

export function Spotlight({
  className,
  fill = "hsl(var(--sage))",
}: {
  className?: string;
  fill?: string;
}) {
  return (
    <svg
      data-testid="spotlight-effect"
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute z-0 h-[150%] w-[150%] -translate-x-1/2 -translate-y-1/3 animate-spotlight opacity-0 blur-3xl",
        className,
      )}
      fill="none"
      viewBox="0 0 600 600"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <filter id="motion-room-spotlight-blur">
          <feGaussianBlur stdDeviation="48" />
        </filter>
      </defs>
      <ellipse
        cx="300"
        cy="210"
        fill={fill}
        fillOpacity="0.72"
        filter="url(#motion-room-spotlight-blur)"
        rx="270"
        ry="112"
      />
    </svg>
  );
}
