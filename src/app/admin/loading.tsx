import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-52" />
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <Skeleton className="h-36" key={item} />
        ))}
      </div>
      <Skeleton className="h-72 w-full" />
    </div>
  );
}
