"use client";

import { LoaderCircle, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
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
import { Button } from "@/components/ui/button";
import type { RemoveResult } from "@/lib/admin/action-result";

interface DeleteRecordButtonProps {
  id: string;
  /** Shown in the confirmation. */
  name: string;
  /** The list to return to once it is deleted. */
  backHref: string;
  removeAction: (id: string) => Promise<RemoveResult>;
}

/**
 * Delete for an entry screen. It sits in the page header, far from Save at the bottom, so a thumb going for Save
 * never lands on it; it always asks first and says it cannot be undone.
 */
export function DeleteRecordButton({ id, name, backHref, removeAction }: DeleteRecordButtonProps) {
  const t = useTranslations("admin.common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isDeleting, startDeleting] = useTransition();

  function confirm() {
    startDeleting(async () => {
      const result = await removeAction(id);
      setOpen(false);
      if (result.ok) {
        toast.success(t("deleted"));
        router.replace(backHref);
        router.refresh();
      } else {
        toast.error(t(`errors.${result.error}`));
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        aria-label={`${t("delete")}: ${name}`}
        className="size-target shrink-0 text-destructive hover:text-destructive"
      >
        <Trash2 aria-hidden />
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle", { name })}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              className="border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20"
              onClick={(event) => {
                event.preventDefault();
                confirm();
              }}
            >
              {isDeleting ? <LoaderCircle className="motion-safe:animate-spin" aria-hidden /> : <Trash2 aria-hidden />}
              {isDeleting ? t("saving") : t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
