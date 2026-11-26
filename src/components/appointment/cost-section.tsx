"use client";

import { LoaderIcon, Pen2Icon } from "@solar-icons/react/line-duotone";
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
    setForm({
      ticket: c?.ticket ? String(c.ticket) : "",
      fnb: c?.fnb ? String(c.fnb) : "",
      other: c?.other ? String(c.other) : "",
      note: c?.note ?? "",
    });
    setEditing(userId);
  }

  const editingTotal = toNumber(form.ticket) + toNumber(form.fnb) + toNumber(form.other);

  const money = (id: string, label: string, field: "ticket" | "fnb" | "other") => (
    <div className="flex flex-col gap-item">
      <Label htmlFor={id} className="text-muted-foreground">{label}</Label>
      <MoneyInput
        id={id}
        placeholder="0"
        enterKeyHint="next"
        disabled={busy}
        value={form[field]}
        onValueChange={(digits) => setForm({ ...form, [field]: digits })}
        className="rounded-xl bg-background px-inset"
      />
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
          const isEditing = editing === p.id;
          return (
            <li key={p.id} className="flex flex-col gap-item rounded-xl border bg-card p-inset">
              <div className="flex items-center gap-item">
                <UserAvatar name={p.name} image={p.avatar} size={PX.avatar} />
                <span className="min-w-0 flex-1 break-words type-item-title">{p.name}</span>
                {view.allPaidByCreator && !isPayerRow ? null : (
                  <span className="shrink-0 type-item-title tabular-nums">{formatVnd(isEditing ? editingTotal : (c?.total ?? 0), locale)}</span>
                )}
                {canEdit && !isEditing ? (
                  <Button type="button" variant="ghost" size="icon" aria-label={t("edit", { name: p.name })} disabled={busy} onClick={() => edit(p.id)}>
                    <Pen2Icon aria-hidden />
                  </Button>
                ) : null}
              </div>
              {!isEditing ? (
                view.allPaidByCreator && !isPayerRow ? (
                  <p className="type-secondary text-muted-foreground">{t("paidByCreator")}</p>
                ) : (
                  <div className="flex flex-col gap-tight">
                    <p className="type-secondary text-muted-foreground tabular-nums">
                      {t("breakdown", { ticket: formatVnd(c?.ticket ?? 0, locale), food: formatVnd(c?.fnb ?? 0, locale), other: formatVnd(c?.other ?? 0, locale) })}
                    </p>
                    {c?.note ? <p className="break-words type-secondary text-muted-foreground">{c.note}</p> : null}
                  </div>
                )
              ) : (
                <form
                  className="flex flex-col gap-field border-t pt-group"
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
                    <Label htmlFor={`cost-note-${p.id}`} className="text-muted-foreground">{t("reason")}</Label>
                    <Input id={`cost-note-${p.id}`} maxLength={200} enterKeyHint="done" disabled={busy} placeholder={t("reasonPlaceholder")} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="rounded-xl bg-background px-inset" />
                  </div>
                  <div className="flex flex-col gap-stack sm:flex-row-reverse">
                    <Button type="submit" size="cta" disabled={busy} className="sm:flex-1">
                      {busy ? <LoaderIcon className="motion-safe:animate-spin" aria-hidden /> : null}
                      {t("save")}
                    </Button>
                    <Button type="button" variant="outline" size="cta-sm" disabled={busy} onClick={() => setEditing(null)} className="sm:min-h-control sm:flex-1">
                      {t("cancel")}
                    </Button>
                  </div>
                </form>
              )}
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
