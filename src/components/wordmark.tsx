import { cn } from "@/lib/utils";

export const APP_NAME = "SeatMate";

/** The app name as a wordmark: "Seat" in the text color, "Mate" in the brand pink. Use this instead of plain text. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-semibold tracking-tight", className)}>
      Seat<span className="text-primary-text">Mate</span>
    </span>
  );
}
