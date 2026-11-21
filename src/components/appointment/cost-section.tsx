"use client";

import { Pencil } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { setPersonCostAction, type ActionResult } from "@/actions/appointments";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/money-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatVnd } from "@/lib/money";
import { PX } from "@/lib/ui-sizes";
import type { AppointmentView } from "@/services/appointment.service";
import type { CostView } from "@/services/appointment-plan.service";

interface Props {
  view: AppointmentView;
  costs: CostView[];
  onSave: (action: () => Promise<ActionResult>, done: string, after?: () => void) => void;
  busy: boolean;
}

const toNumber = (text: string) => (text.trim() === "" ? 0 : Number(text.replace(/\D/g, "")));

/** After the film: what it really cost each person (ticket, food, other), and the group's total. The creator sets anyone's; each person sets their own. */
export function CostSection({ view, costs, onSave, busy }: Props) {
  const t = useTranslations("appointments.detail.cost");
  const locale = useLocale();
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ ticket: "", fnb: "", other: "", note: "" });
  const byUser = new Map(costs.map((c) => [c.userId, c]));
  const total = view.actualCost?.total ?? 0;

  function edit(userId: string) {
    const c = byUser.get(userId);
    setForm({ ticket: String(c?.ticket ?? 0), fnb: String(c?.fnb ?? 0), other: String(c?.other ?? 0), note: c?.note ?? "" });
    setEditing(userId);
  }

  const money = (id: string, label: string, field: "ticket" | "fnb" | "other") => (
    <div className="flex flex-col gap-item">
      <Label htmlFor={id}>{label}</Label>
      <MoneyInput id={id} enterKeyHint="done" value={form[field]} onValueChange={(digits) => setForm({ ...form, [field]: digits })} />
    </div>
  );

  return (
    <section aria-labelledby="appt-cost" className="flex flex-col gap-item">
      <h2 id="appt-cost" className="type-heading">
        {t("title")}
      </h2>
      {view.allPaidByCreator ? <p className="type-secondary text-muted-foreground">{t("allPaidByCreatorNote", { name: view.creator.name })}</p> : null}
      <ul className="flex flex-col gap-stack">
        {view.attendees.map((p) => {
          const c = byUser.get(p.id);
          const mine = p.id === view.viewerId;
          const isPayerRow = view.allPaidByCreator && p.id === view.creator.id;
          // The creator pays for everyone: only their own row can be edited, and only by them.
          const canEdit = view.allPaidByCreator ? view.isCreator && isPayerRow : view.isCreator || mine;
          return (
            <li key={p.id} className="flex flex-col gap-item rounded-xl border bg-card p-inset-sm">
              <div className="flex items-center gap-item">
                <UserAvatar name={p.name} image={p.avatar} size={PX.avatar} />
                <span className="flex min-w-0 flex-1 flex-col gap-tight">
                  <span className="break-words type-item-title">{p.name}</span>
                  {view.allPaidByCreator && !isPayerRow ? (
                    <span className="type-secondary text-muted-foreground">{t("paidByCreator")}</span>
                  ) : (
                    <>
                      <span className="type-secondary text-muted-foreground tabular-nums">
                        {t("breakdown", { ticket: formatVnd(c?.ticket ?? 0, locale), food: formatVnd(c?.fnb ?? 0, locale), other: formatVnd(c?.other ?? 0, locale) })}
                      </span>
                      {c?.note ? <span className="break-words type-secondary text-muted-foreground">{c.note}</span> : null}
                    </>
                  )}
                </span>
                {view.allPaidByCreator && !isPayerRow ? null : <span className="shrink-0 type-item-title tabular-nums">{formatVnd(c?.total ?? 0, locale)}</span>}
                {canEdit && editing !== p.id ? (
                  <Button type="button" variant="ghost" size="icon" aria-label={t("edit", { name: p.name })} disabled={busy} onClick={() => edit(p.id)}>
                    <Pencil aria-hidden />
                  </Button>
                ) : null}
              </div>
              {editing === p.id ? (
                <form
                  className="flex flex-col gap-field"
                  onSubmit={(event) => {
                    event.preventDefault();
                    onSave(
                      () => setPersonCostAction(view.id, { userId: p.id, ticket: toNumber(form.ticket), fnb: toNumber(form.fnb), other: toNumber(form.other), note: form.note.trim() || undefined }),
                      t("saved"),
                      () => setEditing(null),
                    );
                  }}
                >
                  {money(`cost-ticket-${p.id}`, t("ticket"), "ticket")}
                  {money(`cost-fnb-${p.id}`, t("food"), "fnb")}
                  {money(`cost-other-${p.id}`, t("other"), "other")}
                  <div className="flex flex-col gap-item">
                    <Label htmlFor={`cost-note-${p.id}`}>{t("reason")}</Label>
                    <Input id={`cost-note-${p.id}`} maxLength={200} placeholder={t("reasonPlaceholder")} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
                  </div>
                  <div className="flex gap-stack">
                    <Button type="button" variant="outline" size="cta" disabled={busy} onClick={() => setEditing(null)} className="flex-1">
                      {t("cancel")}
                    </Button>
                    <Button type="submit" size="cta" disabled={busy} className="flex-1">
                      {t("save")}
                    </Button>
                  </div>
                </form>
              ) : null}
            </li>
          );
        })}
      </ul>
      <p className="flex items-center justify-between gap-item type-item-title">
        <span>{t("groupTotal")}</span>
        <span className="tabular-nums">{formatVnd(total, locale)}</span>
      </p>
    </section>
  );
}
