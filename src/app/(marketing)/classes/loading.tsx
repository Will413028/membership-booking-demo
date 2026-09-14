import { Skeleton } from "@/components/ui/skeleton";

export default function ClassesLoading() {
  return (
    <section className="page-shell space-y-8 py-12">
      <Skeleton className="h-14 w-72" />
      <Skeleton className="h-32 w-full" />
      <div className="grid gap-5 md:grid-cols-3">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </section>
  );
}
