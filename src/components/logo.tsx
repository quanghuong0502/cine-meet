import Image from "next/image";
import duoWatching from "@/images/characters/duo-watching.png";
import { Wordmark } from "@/components/wordmark";
import { cn } from "@/lib/utils";

interface LogoProps {
  /** Width of the duo illustration in px (the picture is cropped tight, so it is about 1.35x wider than tall). */
  size?: number;
  className?: string;
  /** Text size class for the wordmark, e.g. "type-heading". */
  wordmarkClassName?: string;
}

/**
 * The app logo: the `duo-watching` illustration (Bubu and Dudu) next to the SeatMate wordmark.
 * Imports `duo-watching.png` directly (instead of the whole 6-pose `Mascot` catalogue) so `AppHeader`
 * does not pull unused mascot assets or `useTranslations` into shared layout chunks.
 */
export function Logo({ size = 48, className, wordmarkClassName }: LogoProps) {
  const width = Math.min(size, Math.floor(duoWatching.width / 2));
  const height = Math.round((width * duoWatching.height) / duoWatching.width);
  return (
    <span className={cn("inline-flex items-center gap-stack", className)}>
      <Image
        src={duoWatching}
        alt=""
        aria-hidden
        width={width}
        height={height}
        draggable={false}
        style={{ width, height }}
        className="block select-none object-contain"
      />
      {/* leading-none: the text box is as tall as the font, so its centre lines up with the image centre. */}
      <Wordmark className={cn("leading-none", wordmarkClassName)} />
    </span>
  );
}
