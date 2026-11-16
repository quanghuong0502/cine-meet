import { useTranslations } from "next-intl";
import { Mascot } from "@/components/mascot";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  /** Fills a whole screen instead of just the area it is placed in. */
  fullScreen?: boolean;
  /** Smaller picture, for loading inside part of a page. */
  compact?: boolean;
  className?: string;
}

/**
 * The loading state of the app: Bubu dozing off (`bubu-sleepy`), a still picture with no animation, with "Loading...".
 * Use this for every route-level `loading.tsx` and any area that waits for data; small buttons keep their inline spinner.
 */
export function LoadingState({ fullScreen = false, compact = false, className }: LoadingStateProps) {
  const t = useTranslations("states");
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center gap-3",
        fullScreen ? "min-h-dvh" : compact ? "min-h-48" : "min-h-48 flex-1",
        className,
      )}
    >
      <Mascot pose="bubu-sleepy" size={compact ? 80 : 112} decorative priority />
      <p className="text-sm text-muted-foreground">{t("loading")}</p>
    </div>
  );
}
