import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card>
      <CardHeader>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </p>
        <p className="font-display text-3xl font-bold">{value}</p>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}
