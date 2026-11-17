"use client";

import { useFormatter, useTranslations } from "next-intl";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { EditorVersion } from "./types";

interface Props {
  auditoriumId: string;
  versions: EditorVersion[];
  /** Version being looked at (read-only view), if any. */
  viewingId?: string;
  summary: string;
  backParam: string;
}

/** The "Versions" tab: every saved version of the room, newest first, and the chatbot description of the layout on screen. */
export function VersionsPanel({ auditoriumId, versions, viewingId, summary, backParam }: Props) {
  const t = useTranslations("admin.auditoriums");
  const format = useFormatter();

  return (
    <div className="flex flex-col gap-field" role="tabpanel">
      <ul aria-label={t("editor.versions.listLabel")} className="flex flex-col gap-2">
        {versions.map((v) => {
          const shown = viewingId ? v.id === viewingId : v.current;
          const href = v.current ? `/admin/auditoriums/${auditoriumId}${backParam}` : `/admin/auditoriums/${auditoriumId}?version=${v.id}${backParam ? `&${backParam.slice(1)}` : ""}`;
          return (
            <li key={v.id}>
              <Link
                href={href}
                aria-current={shown ? "page" : undefined}
                className={`flex min-h-row items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 ${shown ? "border-primary" : ""}`}
              >
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="text-base font-semibold">{t("versionBadge", { version: v.version })}</span>
                  <span className="text-sm text-muted-foreground">
                    {t("editor.versions.rowMeta", {
                      count: v.seatCount,
                      date: format.dateTime(new Date(v.createdAt), { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }),
                    })}
                  </span>
                </span>
                {v.current ? <Badge variant="secondary">{t("editor.versions.current")}</Badge> : null}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-3">
        <span className="text-sm leading-none font-medium text-muted-foreground">{t("editor.versions.summary")}</span>
        <p className="rounded-xl border bg-card p-4 text-base break-words">{summary}</p>
      </div>
    </div>
  );
}
