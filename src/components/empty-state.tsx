import { Mascot, type MascotPose } from "@/components/mascot";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  description?: string;
  mascot?: MascotPose;
  /** Mascot placement is decorative here: the title already explains the state. */
  action?: React.ReactNode;
  className?: string;
}

/** Shared body for empty, "coming soon", not-found and error states. */
export function EmptyState({
  title,
  description,
  mascot = "bubu-sleepy",
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 px-6 py-10 text-center",
        className,
      )}
    >
      <Mascot pose={mascot} size={140} decorative priority />
      <h2 className="text-xl font-semibold">{title}</h2>
      {description ? (
        <p className="max-w-xs text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
