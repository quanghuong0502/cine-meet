"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { resolveRoomReportAction } from "@/actions/room-reports";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RoomReportRow } from "@/services/room-report.service";

export function RoomReportsList({ reports }: { reports: RoomReportRow[] }) {
  const t = useTranslations("admin.roomReports");
  const [pending, start] = useTransition();
  const router = useRouter();

  if (reports.length === 0) {
    return <EmptyState mascot="bubu-sleepy" title={t("emptyTitle")} description={t("emptyDescription")} />;
  }

  function resolve(id: string) {
    start(async () => {
      const result = await resolveRoomReportAction(id).catch(() => null);
      if (!result?.ok) {
        toast.error(t("errors.generic"));
        return;
      }
      toast.success(t("resolved"));
      router.refresh();
    });
  }

  return (
    <ul className="flex flex-col gap-stack">
      {reports.map((r) => (
        <li key={r.id} className="flex flex-col gap-item rounded-xl border bg-card p-inset-sm">
          <div className="flex items-center justify-between gap-item">
            <span className="type-item-title">
              {r.branchName} · {r.roomName}
            </span>
            <Badge variant={r.status === "open" ? "secondary" : "outline"}>{t(`status.${r.status}`)}</Badge>
          </div>
          <p className="break-words type-secondary text-muted-foreground">{r.note}</p>
          <p className="type-secondary text-muted-foreground">{t("by", { name: r.reporterName })}</p>
          {r.status === "open" ? (
            <Button type="button" size="pill" variant="outline" disabled={pending} onClick={() => resolve(r.id)}>
              <Check aria-hidden />
              {t("resolve")}
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
