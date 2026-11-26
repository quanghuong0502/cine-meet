import { DangerCircleIcon, DangerTriangleIcon, PiggyBankIcon, Tuning2Icon } from "@solar-icons/react/line-duotone";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { IconBadge } from "@/components/ui/icon-badge";
import { cn } from "@/lib/utils";
import { formatVnd } from "@/lib/money";
import type { BudgetProgress } from "@/services/budget.service";

/** This month's spending against the budget (design 3.1), a bar per category that has one set, warning icon + colour at 80% and 100%. */
export function BudgetCard({ progress }: { progress: BudgetProgress[] }) {
  const t = useTranslations("dashboard.budget");
  const locale = useLocale();
  if (progress.length === 0) {
    return (
      <section className="flex flex-col gap-group rounded-xl border bg-card p-inset">
        <div className="flex items-center gap-item">
          <IconBadge tone="warning">
            <PiggyBankIcon />
          </IconBadge>
          <h2 className="type-heading">{t("title")}</h2>
        </div>
        <p className="type-secondary text-muted-foreground">{t("notSet")}</p>
        <Button asChild variant="outline" size="cta-sm">
          <Link href="/settings">
            <Tuning2Icon aria-hidden />
            {t("configure")}
          </Link>
        </Button>
      </section>
    );
  }
  return (
    <section className="flex flex-col gap-group rounded-xl border bg-card p-inset">
      <div className="flex items-center justify-between gap-stack">
        <div className="flex items-center gap-item">
          <IconBadge tone="warning">
            <PiggyBankIcon />
          </IconBadge>
          <h2 className="type-heading">{t("title")}</h2>
        </div>
        <Button asChild variant="ghost" size="sm" className="-mr-inset-sm text-primary-text">
          <Link href="/settings">{t("edit")}</Link>
        </Button>
      </div>
      {progress.map((p) => {
        const rounded = Math.round(p.percent);
        const over = p.percent >= 100;
        const warn = !over && p.percent >= 80;
        const label = t(`categories.${p.category}`);
        return (
          <div key={p.category} className="flex flex-col gap-stack">
            <div className="flex flex-wrap items-center justify-between gap-x-item gap-y-tight type-secondary">
              <span className="inline-flex items-center gap-tight font-medium">
                {over ? <DangerCircleIcon className="size-icon-sm text-destructive" aria-hidden /> : warn ? <DangerTriangleIcon className="size-icon-sm text-warning" aria-hidden /> : null}
                <span>{label}</span>
                <span className={cn("type-tag tabular-nums", over ? "text-destructive" : warn ? "text-warning" : "text-muted-foreground")}>
                  {rounded}%
                </span>
              </span>
              <span className="tabular-nums text-muted-foreground">
                {formatVnd(p.spent, locale)} / {formatVnd(p.budget, locale)}
              </span>
            </div>
            <div
              role="progressbar"
              aria-label={label}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.min(100, rounded)}
              className="h-track w-full overflow-hidden rounded-full bg-muted"
            >
              <div
                className={cn("h-full rounded-full transition-all", over ? "bg-destructive" : warn ? "bg-warning" : "bg-primary")}
                style={{ width: `${Math.min(100, p.percent)}%` }}
              />
            </div>
          </div>
        );
      })}
    </section>
  );
}
