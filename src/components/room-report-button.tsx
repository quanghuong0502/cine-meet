"use client";

import { Flag } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { reportRoomAction } from "@/actions/room-reports";
import { ReasonDialog } from "@/components/appointment/reason-dialog";
import { Button } from "@/components/ui/button";

/** Lets anyone flag that this room's info or seat map looks wrong (design 2.7). Admin reads these later. */
export function RoomReportButton({ auditoriumId }: { auditoriumId: string }) {
  const t = useTranslations("cinemas.room.report");
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function submit(note: string) {
    if (!note.trim()) return;
    start(async () => {
      const result = await reportRoomAction({ auditoriumId, note }).catch(() => null);
      if (!result?.ok) {
        toast.error(t("error"));
        return;
      }
      toast.success(t("sent"));
      setOpen(false);
    });
  }

  return (
    <>
      <Button type="button" variant="ghost" size="pill" onClick={() => setOpen(true)}>
        <Flag aria-hidden />
        {t("action")}
      </Button>
      <ReasonDialog
        open={open}
        onOpenChange={setOpen}
        title={t("title")}
        description={t("description")}
        reasonLabel={t("noteLabel")}
        reasonPlaceholder={t("notePlaceholder")}
        cancelLabel={t("cancel")}
        confirmLabel={t("send")}
        pending={pending}
        icon={<Flag aria-hidden />}
        onConfirm={submit}
        tone="default"
      />
    </>
  );
}
