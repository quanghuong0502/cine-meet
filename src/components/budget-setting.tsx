"use client";

import { LoaderIcon, PiggyBankIcon } from "@solar-icons/react/line-duotone";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveBudgetAction } from "@/actions/budget";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IconBadge } from "@/components/ui/icon-badge";
import { MoneyInput } from "@/components/money-input";
import { Label } from "@/components/ui/label";
import type { MonthlyBudget } from "@/services/budget.service";

/** This person's own monthly budget for ticket and food (design 3.1), used to warn them at 80% and 100%. Blank = not tracked. */
export function BudgetSetting({ initial }: { initial: MonthlyBudget | null }) {
  const t = useTranslations("settings.budget");
  const [ticket, setTicket] = useState(initial?.ticket && initial.ticket > 0 ? String(initial.ticket) : "");
  const [fnb, setFnb] = useState(initial?.fnb && initial.fnb > 0 ? String(initial.fnb) : "");
  const [pending, start] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const cleanTicket = ticket === "0" ? "" : ticket;
    const cleanFnb = fnb === "0" ? "" : fnb;
    if (cleanTicket !== ticket) setTicket(cleanTicket);
    if (cleanFnb !== fnb) setFnb(cleanFnb);
    start(async () => {
      const result = await saveBudgetAction({ ticket: cleanTicket, fnb: cleanFnb }).catch(() => null);
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
        <div className="flex items-center gap-item">
          <IconBadge tone="warning">
            <PiggyBankIcon />
          </IconBadge>
          <CardTitle className="type-item-title">{t("title")}</CardTitle>
        </div>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-field">
          <div className="flex flex-col gap-item">
            <Label htmlFor="budget-ticket">{t("ticket")}</Label>
            <MoneyInput
              id="budget-ticket"
              enterKeyHint="next"
              placeholder={t("placeholder")}
              value={ticket}
              onValueChange={setTicket}
              className="h-control rounded-xl bg-background px-inset type-body"
            />
          </div>
          <div className="flex flex-col gap-item">
            <Label htmlFor="budget-fnb">{t("fnb")}</Label>
            <MoneyInput
              id="budget-fnb"
              enterKeyHint="done"
              placeholder={t("placeholder")}
              value={fnb}
              onValueChange={setFnb}
              className="h-control rounded-xl bg-background px-inset type-body"
            />
          </div>
          <Button type="submit" size="cta" disabled={pending}>
            {pending ? <LoaderIcon className="motion-safe:animate-spin" aria-hidden /> : null}
            {t("save")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
