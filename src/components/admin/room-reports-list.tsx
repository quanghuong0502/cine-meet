"use client";

import { ArrowRightUpIcon, CheckIcon, LoaderIcon } from "@solar-icons/react/line-duotone";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { resolveRoomReportAction } from "@/actions/room-reports";
import { Chip } from "@/components/admin/auditorium-editor/chips";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDayLong, formatTime } from "@/lib/datetime";
import type { RoomReportRow } from "@/services/room-report.service";

type Filter = "open" | "resolved" | "all";

export function RoomReportsList({ reports }: { reports: RoomReportRow[] }) {
  const t = useTranslations("admin.roomReports");
  const locale = useLocale();
  const openCount = reports.filter((r) => r.status === "open").length;
  const resolvedCount = reports.length - openCount;
  const [filter, setFilter] = useState<Filter>(openCount > 0 ? "open" : "all");
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [, start] = useTransition();

  if (reports.length === 0) {
    return <EmptyState mascot="bubu-sleepy" title={t("emptyTitle")} description={t("emptyDescription")} />;
  }

  function resolve(id: string) {
    setResolvingId(id);
    start(async () => {
      const result = await resolveRoomReportAction(id).catch(() => null);
      setResolvingId(null);
      if (!result?.ok) {
        toast.error(t("errors.generic"));
        return;
      }
      toast.success(t("resolved"));
    });
  }

  const visible = filter === "all" ? reports : reports.filter((r) => r.status === filter);

  return (
    <div className="flex flex-1 flex-col gap-group">
      <div role="group" aria-label={t("filterLabel")} className="flex flex-wrap gap-stack">
        <Chip selected={filter === "open"} onClick={() => setFilter("open")} className="tabular-nums">
          {t("status.open")} ({openCount})
        </Chip>
        <Chip selected={filter === "resolved"} onClick={() => setFilter("resolved")} className="tabular-nums">
          {t("status.resolved")} ({resolvedCount})
        </Chip>
        <Chip selected={filter === "all"} onClick={() => setFilter("all")} className="tabular-nums">
          {t("filterAll")} ({reports.length})
        </Chip>
      </div>

      {visible.length === 0 ? (
        <EmptyState mascot="bubu-sleepy" title={t("emptyFilterTitle")} description={t("emptyDescription")} />
      ) : (
        <ul className="flex flex-col gap-stack">
          {visible.map((r) => {
            const busy = resolvingId === r.id;
            return (
              <li key={r.id} className="flex flex-col gap-item rounded-xl border bg-card p-inset-sm">
                <div className="flex items-start justify-between gap-item">
                  <span className="min-w-0 break-words type-item-title">
                    {r.branchName} · {r.roomName}
                  </span>
                  <Badge variant={r.status === "open" ? "secondary" : "outline"} className="shrink-0">
                    {t(`status.${r.status}`)}
                  </Badge>
                </div>
                <p className="break-words type-body">{r.note}</p>
                <p className="type-secondary text-muted-foreground tabular-nums">
                  {t("by", { name: r.reporterName })} · {formatDayLong(r.createdAt, locale)} · {formatTime(r.createdAt, locale)}
                </p>
                <div className="flex flex-wrap gap-stack">
                  <Button asChild size="cta-sm" variant="outline" className="w-auto px-inset">
                    <Link href={`/admin/auditoriums/${r.auditoriumId}?back=${encodeURIComponent("/admin/settings/room-reports")}`}>
                      <ArrowRightUpIcon aria-hidden />
                      {t("openRoom")}
                    </Link>
                  </Button>
                  {r.status === "open" ? (
                    <Button type="button" size="cta-sm" variant="secondary" disabled={busy} onClick={() => resolve(r.id)} className="w-auto px-inset">
                      {busy ? <LoaderIcon className="motion-safe:animate-spin" aria-hidden /> : <CheckIcon aria-hidden />}
                      {t("resolve")}
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
