import type { ReactNode } from "react";
import { UserAvatar } from "@/components/user-avatar";
import { PX } from "@/lib/ui-sizes";
import { cn } from "@/lib/utils";

interface Props {
  selected: boolean;
  onClick: () => void;
  /** The person (avatar and name), or leave out and pass `icon` for the whole group. */
  person?: { name: string; avatar?: string };
  icon?: ReactNode;
  label?: string;
  /** Short text after the name (a seat code, "no seat yet"). */
  trailing?: string;
}

/** The pill used wherever the creator picks "whose" something is (seats, food): avatar, name, and what they have so far. */
export function PersonChip({ selected, onClick, person, icon, label, trailing }: Props) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "flex min-h-target shrink-0 items-center gap-stack rounded-full border py-tight pr-inset pl-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        selected ? "border-transparent bg-primary text-primary-foreground" : "bg-card",
      )}
    >
      {person ? <UserAvatar name={person.name} image={person.avatar} size={PX.avatar} /> : icon}
      <span className="type-label">{person?.name ?? label}</span>
      {trailing ? <span className="type-label tabular-nums">{trailing}</span> : null}
    </button>
  );
}
