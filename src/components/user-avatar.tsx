import { RemoteImage } from "@/components/remote-image";
import { cn } from "@/lib/utils";

/**
 * "Lan Anh Nguyen" -> "LN": first letter of the first and last word. Anything in brackets is left out ("An (mẫu)" -> "A", not "A("),
 * and a word that starts with a symbol uses its first letter.
 */
export function getInitials(name: string): string {
  const words = name
    .replace(/\([^)]*\)/g, " ")
    .split(/\s+/)
    .map((word) => word.replace(/^[^\p{L}\p{N}]+/u, ""))
    .filter(Boolean);
  const letters = words.length > 1 ? [words[0], words[words.length - 1]] : [words[0] ?? "?"];
  return letters.map((word) => word!.charAt(0).toUpperCase()).join("");
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
        <RemoteImage src={image} alt="" width={size} height={size} sizes={`${size}px`} className="size-full object-cover" />
      ) : (
        getInitials(name)
      )}
    </span>
  );
}
