"use client";

import { UserCheckRoundedIcon } from "@solar-icons/react/line-duotone";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Chip } from "@/components/admin/auditorium-editor/chips";
import { ConfirmDialog } from "@/components/confirm-dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The time being locked, already written out. */
  timeText: string;
  /** People who voted Yes for this time; all start ticked. */
  voters: { id: string; name: string }[];
  pending: boolean;
  onConfirm: (attendeeIds: string[]) => void;
}

/**
 * Asks before locking a time in (the time is the title, so what is being locked is clear at a glance): locking closes the list for good (nobody is added or removed afterwards), so it is a deliberate step.
 * Everyone who voted Yes is ticked; the creator can untick people who are not coming. The parent gives it a `key` per time,
 * so each time starts again with everybody ticked.
 */
export function LockDialog({ open, onOpenChange, timeText, voters, pending, onConfirm }: Props) {
  const t = useTranslations("appointments.detail");
  const [picked, setPicked] = useState<string[]>(() => voters.map((v) => v.id));
  const toggle = (id: string) => setPicked((list) => (list.includes(id) ? list.filter((p) => p !== id) : [...list, id]));

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={timeText}
      titleClassName="tabular-nums"
      description={t("lockDialogDescription")}
      icon={<UserCheckRoundedIcon aria-hidden />}
      confirmLabel={t("lockButton", { count: picked.length + 1 })}
      cancelLabel={t("back")}
      pending={pending}
      confirmDisabled={picked.length === 0}
      onConfirm={() => onConfirm(picked)}
    >
      <div role="group" aria-label={t("lockPickPeople")} className="flex max-h-area-cap flex-wrap gap-stack overflow-y-auto">
        {voters.map((voter) => (
          <Chip key={voter.id} selected={picked.includes(voter.id)} disabled={pending} onClick={() => toggle(voter.id)}>
            <span className="min-w-0 truncate">{voter.name}</span>
          </Chip>
        ))}
      </div>
    </ConfirmDialog>
  );
}
