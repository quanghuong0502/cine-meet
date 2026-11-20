"use client";

import { useLocale, useTranslations } from "next-intl";
import { UserAvatar } from "@/components/user-avatar";
import { formatVnd } from "@/lib/money";
import { PX } from "@/lib/ui-sizes";
import type { AppointmentView } from "@/services/appointment.service";

/** What the viewing costs each person (ticket and food). Only a record of cost: nobody owes anybody. */
export function EstimateList({ view, title, estimate = view.estimate }: { view: AppointmentView; title: string; /** Defaults to what is saved; while planning it is the live figure from the draft. */ estimate?: AppointmentView["estimate"] }) {
  const t = useTranslations("appointments.detail.plan");
  const locale = useLocale();
  const rows = view.attendees.map((person) => {
    const e = estimate.find((x) => x.userId === person.id);
    const ticket = e?.ticket ?? 0;
    const fnb = e?.fnb ?? 0;
    return { person, ticket, fnb, total: ticket + fnb };
  });
  return (
    <section aria-labelledby="appt-estimate" className="flex flex-col gap-item">
      <h2 id="appt-estimate" className="type-heading">
        {title}
      </h2>
      {view.allPaidByCreator ? <p className="type-secondary text-muted-foreground">{t("allPaidByCreatorNote", { name: view.creator.name })}</p> : null}
      <ul className="flex flex-col gap-stack">
        {rows.map(({ person, ticket, fnb, total: sum }) => (
          <li key={person.id} className="flex items-center gap-item rounded-xl border bg-card p-inset-sm">
            <UserAvatar name={person.name} image={person.avatar} size={PX.avatar} />
            <span className="flex min-w-0 flex-1 flex-col gap-tight">
              <span className="break-words type-item-title">{person.name}</span>
              <span className="type-secondary text-muted-foreground tabular-nums">{t("ticketLine", { amount: formatVnd(ticket, locale) })}</span>
              <span className="type-secondary text-muted-foreground tabular-nums">{t("foodLine", { amount: formatVnd(fnb, locale) })}</span>
            </span>
            <span className="shrink-0 type-item-title tabular-nums">{formatVnd(sum, locale)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
