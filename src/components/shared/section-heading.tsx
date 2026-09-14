import { cn } from "@/lib/utils";

export function SectionHeading({
  eyebrow,
  title,
  description,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn("max-w-2xl space-y-3", className)}>
      {eyebrow ? (
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-coral">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="font-display text-3xl font-bold tracking-tight text-ink md:text-5xl">
        {title}
      </h2>
      {description ? (
        <p className="text-lg leading-8 text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
