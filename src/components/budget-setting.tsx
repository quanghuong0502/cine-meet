"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveBudgetAction } from "@/actions/budget";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MoneyInput } from "@/components/money-input";
import { Label } from "@/components/ui/label";
import type { MonthlyBudget } from "@/services/budget.service";

/** This person's own monthly budget for ticket and food (design 3.1), used to warn them at 80% and 100%. Blank = not tracked. */
export function BudgetSetting({ initial }: { initial: MonthlyBudget | null }) {
  const t = useTranslations("settings.budget");
  const [ticket, setTicket] = useState(initial?.ticket !== undefined ? String(initial.ticket) : "");
  const [fnb, setFnb] = useState(initial?.fnb !== undefined ? String(initial.fnb) : "");
  const [pending, start] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    start(async () => {
      const result = await saveBudgetAction({ ticket, fnb }).catch(() => null);
      if (!result?.ok) {
        toast.error(t("error"));
        return;
      }
      toast.success(t("saved"));
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="type-item-title">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-field">
          <div className="flex flex-col gap-item">
            <Label htmlFor="budget-ticket">{t("ticket")}</Label>
            <MoneyInput id="budget-ticket" placeholder={t("placeholder")} value={ticket} onValueChange={setTicket} className="h-control rounded-xl bg-background px-inset type-body" />
          </div>
          <div className="flex flex-col gap-item">
            <Label htmlFor="budget-fnb">{t("fnb")}</Label>
            <MoneyInput id="budget-fnb" placeholder={t("placeholder")} value={fnb} onValueChange={setFnb} className="h-control rounded-xl bg-background px-inset type-body" />
          </div>
          <Button type="submit" size="cta" disabled={pending}>
            {t("save")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
