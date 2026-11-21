import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { formatVnd } from "@/lib/money";
import type { BudgetProgress } from "@/services/budget.service";

/** This month's spending against the budget (design 3.1), a bar per category that has one set, warning colour at 80% and 100%. */
export function BudgetCard({ progress }: { progress: BudgetProgress[] }) {
  const t = useTranslations("dashboard.budget");
  const locale = useLocale();
  if (progress.length === 0) {
    return (
      <section className="flex flex-col gap-group rounded-xl border bg-card p-inset">
        <h2 className="type-heading">{t("title")}</h2>
        <p className="type-secondary text-muted-foreground">{t("notSet")}</p>
      </section>
    );
  }
  return (
    <section className="flex flex-col gap-group rounded-xl border bg-card p-inset">
      <h2 className="type-heading">{t("title")}</h2>
      {progress.map((p) => (
        <div key={p.category} className="flex flex-col gap-stack">
          <div className="flex items-center justify-between gap-item type-secondary">
            <span>{t(`categories.${p.category}`)}</span>
            <span className="tabular-nums text-muted-foreground">
              {formatVnd(p.spent, locale)} / {formatVnd(p.budget, locale)}
            </span>
          </div>
          <div className="h-track w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full", p.percent >= 100 ? "bg-destructive" : p.percent >= 80 ? "bg-primary" : "bg-primary/60")}
              style={{ width: `${Math.min(100, p.percent)}%` }}
            />
          </div>
        </div>
      ))}
    </section>
  );
}
