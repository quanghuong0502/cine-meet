"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /** Without it there is no reason field (leaving an appointment needs none). */
  reasonLabel?: string;
  reasonPlaceholder?: string;
  cancelLabel: string;
  confirmLabel: string;
  pending: boolean;
  icon: React.ReactNode;
  onConfirm: (reason: string) => void;
}

/** Confirmation for something that cannot be undone (turn down, leave, cancel), with an optional reason the others will see. */
export function ReasonDialog({ open, onOpenChange, title, description, reasonLabel, reasonPlaceholder, cancelLabel, confirmLabel, pending, icon, onConfirm }: Props) {
  const [reason, setReason] = useState("");
  return (
    <ConfirmDialog open={open} onOpenChange={onOpenChange} title={title} description={description} tone="destructive" icon={icon} confirmLabel={confirmLabel} cancelLabel={cancelLabel} pending={pending} onConfirm={() => onConfirm(reason)}>
      {reasonLabel ? (
        <div className="flex flex-col gap-item">
          <Label htmlFor="reason" className="type-label text-muted-foreground">
            {reasonLabel}
          </Label>
          <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder={reasonPlaceholder} className="rounded-xl bg-card px-inset type-body" />
        </div>
      ) : null}
    </ConfirmDialog>
  );
}
