import { RootLoading } from "@/components/route-loading";

/** Fallback while any route without its own loading screen is on its way. */
export default function Loading() {
  return <RootLoading />;
}
