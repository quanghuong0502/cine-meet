import { useTranslations } from "next-intl";
import Image, { type StaticImageData } from "next/image";
import bubuGoingOut from "@/images/characters/bubu-going-out.png";
import bubuHappy from "@/images/characters/bubu-happy.png";
import bubuSleepy from "@/images/characters/bubu-sleepy.png";
import duduHappy from "@/images/characters/dudu-happy.png";
import duoWatching from "@/images/characters/duo-watching.png";
import popcorn from "@/images/characters/popcorn.png";
import { cn } from "@/lib/utils";

/**
 * Catalogue of mascot art (quy tắc: .claude/rules/mascots.md). Pick the pose by CONTEXT, not by looks:
 * `usage` says where each one belongs. Files live in src/images/characters as `<nhân-vật>-<tư-thế>.png`
 * (transparent PNG); alt text lives in messages (`mascot.alt.<pose>`). Bubu = gấu trúc trắng, Dudu = gấu nâu, "duo" = cả hai, "prop" = đạo cụ.
 */
export const MASCOT_POSES = {
  "bubu-sleepy": {
    src: bubuSleepy,
    usage: "chờ, đang tải, vắng vẻ, không tìm thấy, lỗi nhẹ",
  },
  "bubu-happy": {
    src: bubuHappy,
    usage: "thành công, hoàn tất, nhận được thông báo tốt, trạng thái 'đã xong'",
  },
  "bubu-going-out": {
    src: bubuGoingOut,
    usage: "sắp đến giờ chiếu, nhắc lịch, 'đi thôi', hướng dẫn bắt đầu, chỉ đường tới rạp",
  },
  "dudu-happy": {
    src: duduHappy,
    usage: "chào mừng, đổi mật khẩu, nhắc nhở thân thiện, danh sách bạn bè",
  },
  "duo-watching": {
    src: duoWatching,
    usage: "màn auth (đăng nhập, đổi mật khẩu), lịch hẹn xem cùng nhau, mời bạn, chưa có lịch hẹn, bạn bè",
  },
  popcorn: {
    src: popcorn,
    usage: "đạo cụ: phần đồ ăn/combo, trạng thái rỗng của đồ ăn, trang trí nhỏ (nét vẽ khác phong cách hai nhân vật)",
  },
} as const satisfies Record<string, { src: StaticImageData; usage: string }>;

export type MascotPose = keyof typeof MASCOT_POSES;

interface MascotProps {
  pose: MascotPose;
  /**
   * Wanted display width in px. It is capped at half the source width so the art stays sharp
   * on 2x (Retina) screens; height follows the source aspect ratio.
   */
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
  pose,
  size = 112,
  decorative = false,
  flip = false,
  priority = false,
  className,
}: MascotProps) {
  const t = useTranslations("mascot.alt");
  const { src } = MASCOT_POSES[pose];
  const width = Math.min(size, Math.floor(src.width / 2));
  const height = Math.round((width * src.height) / src.width);

  return (
    <Image
      src={src}
      alt={decorative ? "" : t(pose)}
      aria-hidden={decorative ? true : undefined}
      width={width}
      height={height}
      priority={priority}
      draggable={false}
      className={cn("block select-none object-contain", flip && "-scale-x-100", className)}
    />
  );
}
