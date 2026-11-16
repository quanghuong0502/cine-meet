import { Skeleton } from "@/components/ui/skeleton";

/** Shown while a master-data page loads: the shape of the list, not a spinner. */
export default function MasterDataLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4" aria-busy="true">
      <Skeleton className="h-9 w-48 rounded-lg" />
      <Skeleton className="h-12 w-full rounded-xl" />
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  );
}
