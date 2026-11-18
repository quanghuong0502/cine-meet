import { Mascot, type MascotPose } from "@/components/mascot";
import { cn } from "@/lib/utils";
import { PX } from "@/lib/ui-sizes";

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
        "flex flex-col items-center gap-item px-inset-lg py-inset-xl text-center",
        className,
      )}
    >
      <Mascot pose={mascot} size={PX.mascot} decorative priority />
      <h2 className="type-heading">{title}</h2>
      {description ? (
        <p className="max-w-hint type-secondary text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-stack">{action}</div> : null}
    </div>
  );
}
