import { useLocale, useTranslations } from "next-intl";
import { formatVnd } from "@/lib/money";
import type { NamedCount } from "@/services/dashboard.service";

/** How many viewings, the average cost of one, and the genres/branches this person goes to most (design 3.1). */
export function StatsCard({ viewingCount, averageCostPerViewing, topGenres, topBranches }: { viewingCount: number; averageCostPerViewing: number; topGenres: NamedCount[]; topBranches: NamedCount[] }) {
  const t = useTranslations("dashboard.stats");
  const locale = useLocale();
  if (viewingCount === 0) {
    return (
      <section className="flex flex-col gap-group rounded-xl border bg-card p-inset">
        <h2 className="type-heading">{t("title")}</h2>
        <p className="type-secondary text-muted-foreground">{t("empty")}</p>
      </section>
    );
  }
  return (
    <section className="flex flex-col gap-group rounded-xl border bg-card p-inset">
      <h2 className="type-heading">{t("title")}</h2>
      <div className="grid grid-cols-2 gap-item">
        <div className="flex flex-col gap-tight">
          <p className="type-secondary text-muted-foreground">{t("countLabel")}</p>
          <p className="type-heading tabular-nums">{viewingCount}</p>
        </div>
        <div className="flex min-w-0 flex-col gap-tight">
          <p className="type-secondary text-muted-foreground">{t("averageLabel")}</p>
          <p className="type-heading tabular-nums">{formatVnd(averageCostPerViewing, locale)}</p>
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
          <li key={i.name} className="max-w-full rounded-full bg-muted px-inset-sm py-tight type-badge">
            {i.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
