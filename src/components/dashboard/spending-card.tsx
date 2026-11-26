import { WalletMoneyIcon } from "@solar-icons/react/line-duotone";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { IconBadge } from "@/components/ui/icon-badge";
import { cn } from "@/lib/utils";
import { formatVnd } from "@/lib/money";
import { SPENDING_PERIODS, type Period } from "@/lib/dashboard/period";
import type { SpendingBucket } from "@/services/expense.service";

/** The money spent in the chosen period, split ticket/food/other, with a full-width bar chart of the last buckets (design 3.1). */
export function SpendingCard({ period, buckets }: { period: Period; buckets: SpendingBucket[] }) {
  const t = useTranslations("dashboard.spending");
  const locale = useLocale();
  const current = buckets[buckets.length - 1];
  const max = Math.max(0, ...buckets.map((b) => b.total));
  const hasAny = max > 0;
  const firstKey = buckets[0]?.key;
  const lastKey = current?.key;

  return (
    <section className="flex flex-col gap-group rounded-xl border bg-card p-inset">
      <div className="flex items-center gap-item">
        <IconBadge tone="primary">
          <WalletMoneyIcon />
        </IconBadge>
        <h2 className="type-heading">{t("title")}</h2>
      </div>
      <div role="group" aria-label={t("title")} className="grid grid-cols-3 rounded-full bg-muted p-tight">
        {SPENDING_PERIODS.map((p) => {
          const active = p === period;
          return (
            <Link
              key={p}
              href={`/?period=${p}`}
              replace
              scroll={false}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-target items-center justify-center rounded-full px-inset-sm type-label transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:opacity-80",
                active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`periods.${p}`)}
            </Link>
          );
        })}
      </div>

      <div className="flex flex-col gap-stack">
        <p className="type-display tabular-nums">{formatVnd(current?.total ?? 0, locale)}</p>
        <dl className="flex flex-wrap gap-x-group gap-y-tight type-secondary text-muted-foreground">
          <div className="flex gap-stack">
            <dt>{t("ticket")}</dt>
            <dd className="tabular-nums text-foreground">{formatVnd(current?.ticket ?? 0, locale)}</dd>
          </div>
          <div className="flex gap-stack">
            <dt>{t("food")}</dt>
            <dd className="tabular-nums text-foreground">{formatVnd(current?.fnb ?? 0, locale)}</dd>
          </div>
          {(current?.other ?? 0) > 0 ? (
            <div className="flex gap-stack">
              <dt>{t("other")}</dt>
              <dd className="tabular-nums text-foreground">{formatVnd(current?.other ?? 0, locale)}</dd>
            </div>
          ) : null}
        </dl>
      </div>

      <div className="flex flex-col gap-tight">
        <div className="flex h-chart items-end gap-tight border-b border-border/60 pb-hair" aria-hidden="true">
          {buckets.map((b) => {
            const isCurrent = b.key === current?.key;
            const pct = hasAny ? Math.max(b.total > 0 ? 10 : 4, Math.round((b.total / max) * 100)) : 4;
            return (
              <div
                key={b.key}
                className={cn(
                  "min-w-0 flex-1 rounded-t-sm transition-all",
                  hasAny && isCurrent ? "bg-primary" : hasAny && b.total > 0 ? "bg-muted-foreground/35" : "bg-muted",
                )}
                style={{ height: `${pct}%` }}
              />
            );
          })}
        </div>
        {firstKey && lastKey ? (
          <div className="flex justify-between type-micro text-muted-foreground tabular-nums" aria-hidden="true">
            <span>{firstKey}</span>
            <span>{lastKey}</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
