import { Mascot } from "@/components/mascot";
import { Wordmark } from "@/components/wordmark";
import { cn } from "@/lib/utils";

interface LogoProps {
  /** Width of the duo illustration in px (the picture is cropped tight, so it is about 1.35x wider than tall). */
  size?: number;
  className?: string;
  /** Text size class for the wordmark, e.g. "text-xl". */
  wordmarkClassName?: string;
}

/**
 * The app logo: the `duo-watching` illustration (Bubu and Dudu) next to the SeatMate wordmark.
 * The same illustration, on the brand pink, is the home-screen icon (public/icons, src/app/apple-icon.png).
 * The wordmark already names the app, so the illustration is decorative.
 */
export function Logo({ size = 48, className, wordmarkClassName }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Mascot pose="duo-watching" size={size} decorative priority />
      {/* leading-none: the text box is as tall as the font, so its centre lines up with the image centre. */}
      <Wordmark className={cn("leading-none", wordmarkClassName)} />
    </span>
  );
}
