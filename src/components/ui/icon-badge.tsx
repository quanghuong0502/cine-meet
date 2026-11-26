import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type IconBadgeTone = "primary" | "info" | "success" | "warning" | "destructive" | "muted";
export type IconBadgeSize = "sm" | "md";

const TONE_CLASS: Record<IconBadgeTone, string> = {
  primary: "bg-accent text-primary-text",
  info: "bg-info/15 text-info",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  destructive: "bg-destructive/12 text-destructive",
  muted: "bg-muted text-muted-foreground",
};

const SIZE_CLASS: Record<IconBadgeSize, string> = {
  sm: "size-stepper rounded-xl [&_svg:not([class*='size-'])]:size-icon-sm",
  md: "size-avatar rounded-2xl [&_svg:not([class*='size-'])]:size-icon",
};

interface IconBadgeProps {
  tone?: IconBadgeTone;
  size?: IconBadgeSize;
  className?: string;
  children: ReactNode;
}

/** Soft pastel rounded icon pill used for card headers, menu rows, and notifications so icons feel warm and scannable in both themes. */
export function IconBadge({ tone = "primary", size = "sm", className, children }: IconBadgeProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        SIZE_CLASS[size],
        TONE_CLASS[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
