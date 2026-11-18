"use client";

import { LoaderCircle, UserLock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Chip } from "@/components/admin/auditorium-editor/chips";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="type-item-title tabular-nums">{timeText}</AlertDialogTitle>
          <AlertDialogDescription>{t("lockDialogDescription")}</AlertDialogDescription>
        </AlertDialogHeader>
        <div role="group" aria-label={t("lockPickPeople")} className="flex flex-wrap gap-stack">
          {voters.map((voter) => (
            <Chip key={voter.id} selected={picked.includes(voter.id)} disabled={pending} onClick={() => toggle(voter.id)}>
              {voter.name}
            </Chip>
          ))}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{t("back")}</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending || picked.length === 0}
            onClick={(event) => {
              event.preventDefault();
              onConfirm(picked);
            }}
          >
            {pending ? <LoaderCircle className="motion-safe:animate-spin" aria-hidden /> : <UserLock aria-hidden />}
            {t("lockButton", { count: picked.length })}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
