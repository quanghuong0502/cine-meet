"use client";

import { LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
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
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  /** Extra look of the title (for example `tabular-nums` when it is a time). */
  titleClassName?: string;
  description?: string;
  /** `destructive` (red) for anything that deletes, cancels, locks out or cannot be taken back; `default` otherwise. */
  tone?: "default" | "destructive";
  /** The icon in front of the confirm label; it turns into a spinner while `pending`. */
  icon?: ReactNode;
  /** A verb that says what the button does ("Delete", "Cancel plan"), never "OK". */
  confirmLabel: string;
  /** "Cancel" unless the confirm label itself says "Cancel ..." (then use "Back"). */
  cancelLabel?: string;
  pending?: boolean;
  /** Keeps the confirm button off, for example while nothing is picked yet. */
  confirmDisabled?: boolean;
  onConfirm: () => void;
  /** More to ask between the text and the buttons (a reason field, people to tick). */
  children?: ReactNode;
}

/**
 * The one confirmation popup of the app, so every title, description and pair of buttons looks and behaves the same
 * (Apple HIG, Alerts: a verb on the confirm button, a plain Cancel, red for what is destructive, progress shown inside the button).
 * Use it for every "are you sure": do not put an AlertDialog together by hand.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  titleClassName,
  description,
  tone = "default",
  icon,
  confirmLabel,
  cancelLabel,
  pending = false,
  confirmDisabled = false,
  onConfirm,
  children,
}: ConfirmDialogProps) {
  const t = useTranslations("confirmDialog");
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {/* Focus goes to the popup itself, not to Cancel: a focused Cancel drew a heavy ring that made the two buttons look uneven. */}
      <AlertDialogContent onOpenAutoFocus={(event) => event.preventDefault()}>
        <AlertDialogHeader>
          <AlertDialogTitle className={cn("type-item-title", titleClassName)}>{title}</AlertDialogTitle>
          {description ? <AlertDialogDescription className="text-balance">{description}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter className="flex-row">
          <AlertDialogCancel disabled={pending} className="min-w-0 flex-1 gap-tight px-inset-xs whitespace-nowrap [&_svg]:size-icon-sm">{cancelLabel ?? t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending || confirmDisabled}
            className={cn("min-w-0 flex-1 gap-tight px-inset-xs whitespace-nowrap [&_svg]:size-icon-sm", tone === "destructive" && "border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20")}
            onClick={(event) => {
              // The popup stays open until the work is done; the parent closes it.
              event.preventDefault();
              onConfirm();
            }}
          >
            {pending ? <LoaderCircle className="motion-safe:animate-spin" aria-hidden /> : icon}
            {pending ? t("pending") : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
