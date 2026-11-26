"use client";

import { useId, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { RequiredMark } from "@/components/required-mark";
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
  required?: boolean;
  maxLength?: number;
  cancelLabel: string;
  confirmLabel: string;
  pending: boolean;
  icon: React.ReactNode;
  onConfirm: (reason: string) => void;
  /** `default` for something harmless like a report (the default is `destructive`, for turning down, leaving or cancelling). */
  tone?: "default" | "destructive";
}

/** Confirmation with an optional (or required) reason. Resets text whenever closed so stale text never carries over. */
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  reasonLabel,
  reasonPlaceholder,
  required = false,
  maxLength = 200,
  cancelLabel,
  confirmLabel,
  pending,
  icon,
  onConfirm,
  tone = "destructive",
}: Props) {
  const fieldId = useId();
  const [reason, setReason] = useState("");

  function handleOpenChange(next: boolean) {
    if (!next) setReason("");
    onOpenChange(next);
  }

  const missingRequired = Boolean(reasonLabel && required && !reason.trim());

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      description={description}
      tone={tone}
      icon={icon}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      pending={pending}
      confirmDisabled={missingRequired}
      onConfirm={() => {
        if (missingRequired) return;
        onConfirm(reason);
      }}
    >
      {reasonLabel ? (
        <div className="flex flex-col gap-item">
          <Label htmlFor={fieldId} className="type-label text-muted-foreground">
            <span>
              {reasonLabel}
              {required ? <RequiredMark /> : null}
            </span>
          </Label>
          <Textarea
            id={fieldId}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={maxLength}
            aria-required={required || undefined}
            disabled={pending}
            placeholder={reasonPlaceholder}
            className="rounded-xl bg-background px-inset type-body"
          />
        </div>
      ) : null}
    </ConfirmDialog>
  );
}
