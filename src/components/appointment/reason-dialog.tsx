"use client";

import { LoaderCircle } from "lucide-react";
import { useState } from "react";
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
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="type-item-title">{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {reasonLabel ? (
          <div className="flex flex-col gap-item">
            <Label htmlFor="reason" className="type-label text-muted-foreground">
              {reasonLabel}
            </Label>
            <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder={reasonPlaceholder} className="rounded-xl bg-card px-inset type-body" />
          </div>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            className="border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20"
            onClick={(event) => {
              event.preventDefault();
              onConfirm(reason);
            }}
          >
            {pending ? <LoaderCircle className="motion-safe:animate-spin" aria-hidden /> : icon}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
