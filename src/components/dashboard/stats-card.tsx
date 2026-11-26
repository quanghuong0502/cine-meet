import { TicketStarIcon } from "@solar-icons/react/line-duotone";
import { useLocale, useTranslations } from "next-intl";
import { IconBadge } from "@/components/ui/icon-badge";
import { formatVnd } from "@/lib/money";
import type { NamedCount } from "@/services/dashboard.service";

/** How many viewings, the average cost of one, and the genres/branches this person goes to most (design 3.1). */
export function StatsCard({ viewingCount, averageCostPerViewing, topGenres, topBranches }: { viewingCount: number; averageCostPerViewing: number; topGenres: NamedCount[]; topBranches: NamedCount[] }) {
  const t = useTranslations("dashboard.stats");
  const locale = useLocale();
  if (viewingCount === 0) {
    return (
      <section className="flex flex-col gap-group rounded-xl border bg-card p-inset">
        <div className="flex items-center gap-item">
          <IconBadge tone="info">
            <TicketStarIcon />
          </IconBadge>
          <h2 className="type-heading">{t("title")}</h2>
        </div>
        <p className="type-secondary text-muted-foreground">{t("empty")}</p>
      </section>
    );
  }
  return (
    <section className="flex flex-col gap-group rounded-xl border bg-card p-inset">
      <div className="flex items-center gap-item">
        <IconBadge tone="info">
          <TicketStarIcon />
        </IconBadge>
        <h2 className="type-heading">{t("title")}</h2>
      </div>
      <div className="grid grid-cols-2 gap-item">
        <div className="flex flex-col gap-tight rounded-lg bg-muted/40 p-inset-sm">
          <p className="type-caption text-muted-foreground">{t("countLabel")}</p>
          <p className="type-title tabular-nums">{viewingCount}</p>
        </div>
        <div className="flex min-w-0 flex-col gap-tight rounded-lg bg-muted/40 p-inset-sm">
          <p className="type-caption text-muted-foreground">{t("averageLabel")}</p>
          <p className="truncate type-title tabular-nums" title={formatVnd(averageCostPerViewing, locale)}>
            {formatVnd(averageCostPerViewing, locale)}
          </p>
        </div>
      </div>
      <TopList label={t("genres")} items={topGenres} />
      <TopList label={t("branches")} items={topBranches} />
    </section>
  );
}

function TopList({ label, items }: { label: string; items: NamedCount[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-stack border-t pt-group">
      <p className="type-secondary text-muted-foreground">{label}</p>
      <ul className="flex flex-wrap gap-stack">
        {items.map((i) => (
          <li key={i.id} title={i.name} className="inline-flex max-w-full items-center gap-tight rounded-full bg-muted px-inset-sm py-tight type-badge">
            <span className="truncate">{i.name}</span>
            <span className="shrink-0 text-muted-foreground tabular-nums">· {i.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
