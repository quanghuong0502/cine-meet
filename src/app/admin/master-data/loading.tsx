import { LoadingState } from "@/components/loading-state";
import { Skeleton } from "@/components/ui/skeleton";

/** The page title area keeps its shape; the waiting list area shows Bubu. */
export default function MasterDataLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4" aria-busy="true">
      <Skeleton className="h-9 w-48 rounded-lg" />
      <Skeleton className="h-target w-40 rounded-full" />
      <LoadingState compact />
    </div>
  );
}
