import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatVnd } from "@/lib/money";
import { SPENDING_PERIODS, type Period } from "@/lib/dashboard/period";
import type { SpendingBucket } from "@/services/expense.service";

/** The money spent in the chosen period, split ticket/food, with a small bar chart of the last buckets (design 3.1). */
export function SpendingCard({ period, buckets }: { period: Period; buckets: SpendingBucket[] }) {
  const t = useTranslations("dashboard.spending");
  const locale = useLocale();
  const current = buckets[buckets.length - 1];
  const max = Math.max(1, ...buckets.map((b) => b.total));

  return (
    <section className="flex flex-col gap-group rounded-xl border bg-card p-inset">
      <div className="flex items-center justify-between gap-item">
        <h2 className="type-heading">{t("title")}</h2>
        <div className="flex gap-tight">
          {SPENDING_PERIODS.map((p) => (
            <Link
              key={p}
              href={`/?period=${p}`}
              scroll={false}
              className={cn(
                "rounded-full px-inset-sm py-tight type-badge",
                p === period ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {t(`periods.${p}`)}
            </Link>
          ))}
        </div>
      </div>
      <p className="type-title tabular-nums">{formatVnd(current?.total ?? 0, locale)}</p>
      <div className="flex items-stretch justify-between gap-group">
        <dl className="type-secondary flex min-w-0 flex-col gap-tight text-muted-foreground">
          <div className="flex flex-wrap gap-x-stack">
            <dt>{t("ticket")}</dt>
            <dd className="tabular-nums">{formatVnd(current?.ticket ?? 0, locale)}</dd>
          </div>
          <div className="flex flex-wrap gap-x-stack">
            <dt>{t("food")}</dt>
            <dd className="tabular-nums">{formatVnd(current?.fnb ?? 0, locale)}</dd>
          </div>
        </dl>
        <div className="flex w-area-cap shrink-0 items-end gap-tight" aria-hidden="true">
          {buckets.map((b) => (
            <div
              key={b.key}
              className={cn("min-w-0 flex-1 rounded-t-sm", b.key === current?.key ? "bg-primary" : "bg-muted-foreground/30")}
              style={{ height: `${Math.max(8, Math.round((b.total / max) * 100))}%` }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
