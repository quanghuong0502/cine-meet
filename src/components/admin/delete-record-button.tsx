"use client";

import { TrashBinMinimalisticIcon } from "@solar-icons/react/line-duotone";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { LazyConfirmDialog } from "@/components/lazy-dialogs";
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
 * Delete for an entry screen: the red "Delete" button beside Save in the bottom bar. It always asks first and says it
 * cannot be undone.
 */
export function DeleteRecordButton({ id, name, backHref, removeAction }: DeleteRecordButtonProps) {
  const t = useTranslations("admin.common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isDeleting, startDeleting] = useTransition();

  function confirm() {
    startDeleting(async () => {
      const result = await removeAction(id).catch(() => null);
      setOpen(false);
      if (!result) {
        toast.error(t("errors.network"));
        return;
      }
      if (result.ok) {
        toast.success(t("deleted"));
        // The delete action ran revalidatePath, so the list opens fresh (no router.refresh()).
        router.replace(backHref);
      } else {
        toast.error(t(`errors.${result.error}`));
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="cta"
        onClick={() => setOpen(true)}
        aria-label={`${t("delete")}: ${name}`}
        className="pointer-events-auto w-auto shrink-0 border-destructive/40 bg-background px-inset text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        <TrashBinMinimalisticIcon aria-hidden />
        {t("delete")}
      </Button>
      {open ? (
        <LazyConfirmDialog open={open} onOpenChange={setOpen} title={t("deleteTitle", { name })} description={t("deleteDescription")} tone="destructive" icon={<TrashBinMinimalisticIcon aria-hidden />} confirmLabel={t("delete")} pending={isDeleting} onConfirm={confirm} />
      ) : null}
    </>
  );
}
