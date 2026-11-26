import { LoadingState } from "@/components/loading-state";

/** Fallback while any route without its own loading screen is on its way. */
export default function Loading() {
  return <LoadingState fullScreen />;
}
