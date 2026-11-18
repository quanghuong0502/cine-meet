import Image from "next/image";
import { cn } from "@/lib/utils";

/** "Lan Anh Nguyen" -> "LN": first letter of the first and last word. */
export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0], words[words.length - 1]] : [words[0] ?? "?"];
  return letters.map((word) => word.charAt(0).toUpperCase()).join("");
}

interface UserAvatarProps {
  name: string;
  /** The picture; initials are shown when there is none. */
  image?: string;
  /** Diameter in px. */
  size: number;
  className?: string;
}

/** A person's round avatar: their picture, or their initials on the brand colour. */
export function UserAvatar({ name, image, size, className }: UserAvatarProps) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary font-semibold text-primary-foreground",
        size >= 64 ? "type-heading" : "type-secondary font-semibold!",
        className,
      )}
    >
      {image ? (
        // Already resized and optimised by Cloudinary (256px square), so Next does not process it again.
        <Image src={image} alt="" width={size} height={size} unoptimized className="size-full object-cover" />
      ) : (
        getInitials(name)
      )}
    </span>
  );
}
