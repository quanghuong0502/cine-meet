"use client";

import { CalendarClock, LoaderCircle, Plus, Save, ThumbsDown, ThumbsUp, Undo2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { submitResponseAction } from "@/actions/appointments";
import { Chip } from "@/components/admin/auditorium-editor/chips";
import { DateTimeField } from "@/components/date-time-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { vietnamToIso } from "@/lib/appointment/datetime";
import { MAX_TIME_OPTIONS } from "@/lib/appointment/limits";
import type { AppointmentView } from "@/services/appointment.service";

type Vote = "yes" | "no" | null;

interface Props {
  view: AppointmentView;
  /** The person may still answer (invited, poll open, before the answer-by time). */
  canVote: boolean;
  nameOf: Map<string, string>;
  when: (iso: string) => string;
}

/**
 * The candidate times with how people voted. A person who may still answer sets Yes/No on each time and suggests more times,
 * all on screen only: nothing is sent until they press "Save answers" (fixed at the bottom, above the menu), which sends the lot
 * at once. The counts and names show the person's own draft straight away. The parent gives this a `key` that changes after a save,
 * so it starts again from what the server now has.
 */
export function PollSection({ view, canVote, nameOf, when }: Props) {
  const t = useTranslations("appointments.detail");
  const tc = useTranslations("appointments");
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<Record<string, Vote>>(() => Object.fromEntries(view.options.map((o) => [o.id, o.myVote ?? null])));
  const [proposals, setProposals] = useState<string[]>([]);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [error, setError] = useState("");

  const changed = view.options.filter((o) => (draft[o.id] ?? null) !== (o.myVote ?? null));
  const dirty = changed.length > 0 || proposals.length > 0;

  function addProposal() {
    const iso = vietnamToIso(date, time);
    if (!iso || new Date(iso).getTime() <= Date.now()) return setError(t("proposeInvalid"));
    if (view.responseDeadline && new Date(iso).getTime() <= new Date(view.responseDeadline).getTime()) return setError(tc("errors.option_before_deadline"));
    const taken = [...view.options.map((o) => new Date(o.startAt).getTime()), ...proposals.map((p) => new Date(p).getTime())];
    if (taken.includes(new Date(iso).getTime())) return setError(tc("errors.duplicate"));
    if (view.options.length + proposals.length >= MAX_TIME_OPTIONS) return setError(tc("errors.limit"));
    setError("");
    setProposals([...proposals, iso]);
    setDate("");
    setTime("");
  }

  function discard() {
    setDraft(Object.fromEntries(view.options.map((o) => [o.id, o.myVote ?? null])));
    setProposals([]);
    setError("");
  }

  function save() {
    start(async () => {
      const result = await submitResponseAction(view.id, {
        votes: changed.map((o) => ({ optionId: o.id, vote: draft[o.id] ?? null })),
        proposals: proposals.map((startAt) => ({ startAt })),
      }).catch(() => null);
      if (!result) {
        toast.error(tc("networkError"));
        return;
      }
      if (!result.ok) {
        toast.error(tc(`errors.${result.error}`));
        return;
      }
      toast.success(t("saved"));
    });
  }

  const myName = nameOf.get(view.viewerId);

  return (
    <section aria-labelledby="appt-poll" className="flex flex-col gap-item">
      <h2 id="appt-poll" className="type-heading">
        {t("times")}
      </h2>
      <ul className="flex flex-col gap-stack">
        {view.options.map((option) => {
          const mine = draft[option.id] ?? null;
          // Everyone else's saved votes, plus this person's draft in place of their saved one.
          const others = option.votes.filter((v) => v.userId !== view.viewerId);
          const yesNames = [...others.filter((v) => v.vote === "yes").map((v) => nameOf.get(v.userId) ?? view.creator.name), ...(mine === "yes" && myName ? [myName] : [])];
          const yes = others.filter((v) => v.vote === "yes").length + (mine === "yes" ? 1 : 0);
          const no = others.filter((v) => v.vote === "no").length + (mine === "no" ? 1 : 0);
          return (
            <li key={option.id} className="flex flex-col gap-stack rounded-xl border bg-card p-inset-sm">
              <div className="flex flex-col gap-tight">
                <span className="type-item-title tabular-nums">{when(option.startAt)}</span>
                {option.place ? <span className="break-words type-secondary text-muted-foreground">{option.place}</span> : null}
                {option.proposedBy ? <span className="type-secondary text-muted-foreground">{t("proposedBy", { name: option.proposedBy.name })}</span> : null}
              </div>
              <p className="type-secondary text-muted-foreground">
                {t("tally", { yes, no })}
                {yesNames.length > 0 ? ` · ${yesNames.join(", ")}` : ""}
              </p>
              {canVote ? (
                <div role="group" aria-label={t("yourVote")} className="flex gap-stack">
                  <Chip selected={mine === "yes"} disabled={pending} onClick={() => setDraft({ ...draft, [option.id]: mine === "yes" ? null : "yes" })}>
                    <ThumbsUp className="size-icon-sm" aria-hidden />
                    {t("yes")}
                  </Chip>
                  <Chip selected={mine === "no"} disabled={pending} onClick={() => setDraft({ ...draft, [option.id]: mine === "no" ? null : "no" })}>
                    <ThumbsDown className="size-icon-sm" aria-hidden />
                    {t("no")}
                  </Chip>
                </div>
              ) : null}
            </li>
          );
        })}

        {proposals.map((iso) => (
          <li key={iso} className="flex items-start gap-item rounded-xl border border-primary bg-accent p-inset-sm">
            <div className="flex min-w-0 flex-1 flex-col gap-stack">
              <span className="type-item-title tabular-nums">{when(iso)}</span>
              <span className="flex flex-wrap items-center gap-stack">
                <Badge variant="secondary" className="h-auto py-hair type-tag">
                  {t("unsaved")}
                </Badge>
                <span className="type-secondary text-muted-foreground">{t("proposedYes")}</span>
              </span>
            </div>
            <Button type="button" variant="ghost" size="icon" disabled={pending} aria-label={t("removeProposal")} onClick={() => setProposals(proposals.filter((p) => p !== iso))}>
              <X aria-hidden />
            </Button>
          </li>
        ))}
      </ul>

      {canVote ? (
        <div className="flex flex-col gap-stack">
          <span className="type-label text-muted-foreground">
            <CalendarClock className="mr-stack inline size-icon-sm align-text-bottom" aria-hidden />
            {t("proposeLabel")}
          </span>
          <div className="flex gap-stack">
            <DateTimeField kind="date" label={t("proposeDate")} value={date} onChange={setDate} className="min-w-0 flex-1" />
            <DateTimeField kind="time" label={t("proposeTime")} value={time} onChange={setTime} className="w-time-field" />
            <Button type="button" variant="outline" size="icon" className="size-control shrink-0" disabled={pending} aria-label={t("proposeButton")} onClick={addProposal}>
              <Plus aria-hidden />
            </Button>
          </div>
          {error ? (
            <p role="alert" className="type-secondary text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}

      {canVote && dirty ? (
        <>
          {/* Room for the fixed bar, so the last thing on the page can scroll clear of it. */}
          <div aria-hidden className="h-action-clear shrink-0" />
          <div data-bottom-fixed className="pointer-events-none fixed inset-x-0 bottom-[var(--nav-clearance)] z-30 px-inset">
            <div className="mx-auto flex max-w-form items-center gap-stack">
              <Button type="button" variant="outline" size="cta" disabled={pending} onClick={discard} aria-label={t("discard")} className="pointer-events-auto shrink-0 px-inset">
                <Undo2 aria-hidden />
              </Button>
              <Button type="button" size="cta" disabled={pending} onClick={save} className="pointer-events-auto min-w-0 flex-1">
                {pending ? <LoaderCircle className="motion-safe:animate-spin" aria-hidden /> : <Save aria-hidden />}
                {t("save")}
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
