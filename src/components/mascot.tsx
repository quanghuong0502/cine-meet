import Image from "next/image";
import bubuImage from "@/images/characters/bubu-transparent.png";
import duduImage from "@/images/characters/dudu-transparent.png";
import { cn } from "@/lib/utils";

/**
 * The app's two mascots (quy tắc: .claude/rules/mascots.md).
 * Bubu = chú gấu trúc ngái ngủ ôm bắp rang: chờ, tải, vắng vẻ, lỗi nhẹ.
 * Dudu = chú gấu nâu vui vẻ ôm bắp rang: chào mừng, thành công, hoàn tất.
 */
const MASCOTS = {
  bubu: { src: bubuImage, alt: "Bubu, chú gấu trúc ôm bắp rang" },
  dudu: { src: duduImage, alt: "Dudu, chú gấu nâu ôm bắp rang" },
} as const;

export type MascotName = keyof typeof MASCOTS;

interface MascotProps {
  name: MascotName;
  /** Displayed width and height in px. Source art is small (240 to 360px): keep this at 180 or below. */
  size?: number;
  /** Purely decorative next to text that already says everything: hides it from screen readers. */
  decorative?: boolean;
  /** Mirror the image so the mascot looks toward the content. */
  flip?: boolean;
  /** Only for mascots above the fold on first paint. */
  priority?: boolean;
  className?: string;
}

export function Mascot({
  name,
  size = 112,
  decorative = false,
  flip = false,
  priority = false,
  className,
}: MascotProps) {
  const { src, alt } = MASCOTS[name];
  return (
    <Image
      src={src}
      alt={decorative ? "" : alt}
      aria-hidden={decorative ? true : undefined}
      width={size}
      height={size}
      priority={priority}
      draggable={false}
      className={cn("select-none object-contain", flip && "-scale-x-100", className)}
    />
  );
}
