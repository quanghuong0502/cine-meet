import { useTranslations } from "next-intl";
import Image from "next/image";
import bubuSleepy from "@/images/characters/bubu-sleepy.png";
import { PX } from "@/lib/ui-sizes";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  /** Fills a whole screen instead of just the area it is placed in. */
  fullScreen?: boolean;
  /** Smaller picture, for loading inside part of a page (still centred in the space left under the title and tabs). */
  compact?: boolean;
  className?: string;
}

/**
 * The loading state of the app: Bubu dozing off (`bubu-sleepy`), a still picture with no animation, with "Loading...".
 * Imports `bubu-sleepy` directly instead of the full Mascot catalogue so shared chunks do not carry all 6 poses.
 */
export function LoadingState({ fullScreen = false, compact = false, className }: LoadingStateProps) {
  const t = useTranslations("states");
  const target = compact ? PX.mascotXs : PX.mascotSm;
  const width = Math.min(target, Math.floor(bubuSleepy.width / 2));
  const height = Math.round((width * bubuSleepy.height) / bubuSleepy.width);
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex w-full flex-col items-center justify-center gap-item text-center",
        fullScreen ? "min-h-dvh" : compact ? "min-h-area flex-1 py-inset" : "min-h-area-lg flex-1 p-inset",
        className,
      )}
    >
      <Image
        src={bubuSleepy}
        alt=""
        aria-hidden
        width={width}
        height={height}
        draggable={false}
        style={{ width, height }}
        className="block select-none object-contain"
      />
      <p className="type-secondary text-muted-foreground">{t("loading")}</p>
    </div>
  );
}
