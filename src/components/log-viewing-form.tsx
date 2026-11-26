"use client";

import { DangerCircleIcon, LoaderIcon, PlaneIcon } from "@solar-icons/react/line-duotone";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { logManualViewingAction } from "@/actions/expenses";
import { DateTimeField } from "@/components/date-time-field";
import { MoneyInput } from "@/components/money-input";
import { RequiredMark } from "@/components/required-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { vietnamToday } from "@/lib/movie/status";

const CONTROL = "h-control w-full rounded-xl bg-card px-inset type-body";

interface Props {
  movies: { id: string; title: string }[];
  rooms: { id: string; label: string }[];
}

/**
 * Logs a viewing that did not go through an appointment (design 3.4 "Bổ sung"): watched alone, or booked outside the app.
 * Movie and room are optional — only the date is required — because the point is to keep the dashboard's numbers complete
 * even when the person does not remember or care about the details.
 */
export function LogViewingForm({ movies, rooms }: Props) {
  const t = useTranslations("dashboard.logViewing");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [movieId, setMovieId] = useState("none");
  const [auditoriumId, setAuditoriumId] = useState("none");
  const [date, setDate] = useState(vietnamToday());
  const [ticket, setTicket] = useState("");
  const [fnb, setFnb] = useState("");
  const [other, setOther] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dateError, setDateError] = useState(false);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setDateError(false);
    if (!date) {
      setDateError(true);
      setError(t("error"));
      return;
    }
    start(async () => {
      const result = await logManualViewingAction({ movieId, auditoriumId, date, ticket, fnb, other, note }).catch(() => null);
      if (!result?.ok) {
        if (result?.error === "future_date") {
          setDateError(true);
          setError(t("futureDate"));
        } else {
          setError(t("error"));
        }
        return;
      }
      toast.success(t("saved"));
      router.push("/");
    });
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-1 flex-col gap-field">
      {error ? (
        <p role="alert" className="flex items-start gap-stack rounded-xl border border-destructive/30 bg-destructive/10 px-inset py-inset-sm type-secondary text-destructive">
          <DangerCircleIcon className="mt-hair size-icon-sm shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-item">
        <Label htmlFor="log-date" className="text-muted-foreground">
          <span>
            {t("date")}
            <RequiredMark />
          </span>
        </Label>
        <DateTimeField
          id="log-date"
          kind="date"
          label={t("date")}
          value={date}
          max={vietnamToday()}
          required
          aria-required
          aria-invalid={dateError}
          disabled={pending}
          onChange={(next) => {
            setDate(next);
            setDateError(false);
            setError(null);
          }}
        />
      </div>

      <div className="flex flex-col gap-item">
        <Label htmlFor="log-movie" className="text-muted-foreground">{t("movie")}</Label>
        <Select value={movieId} onValueChange={setMovieId} disabled={pending}>
          <SelectTrigger id="log-movie" className={CONTROL}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t("noMovie")}</SelectItem>
            {movies.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-item">
        <Label htmlFor="log-room" className="text-muted-foreground">{t("room")}</Label>
        <Select value={auditoriumId} onValueChange={setAuditoriumId} disabled={pending}>
          <SelectTrigger id="log-room" className={CONTROL}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t("noRoom")}</SelectItem>
            {rooms.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-field sm:grid-cols-3 sm:items-end sm:gap-stack">
        <div className="flex min-w-0 flex-col gap-item">
          <Label htmlFor="log-ticket" className="text-muted-foreground">{t("ticket")}</Label>
          <MoneyInput id="log-ticket" value={ticket} onValueChange={setTicket} placeholder={t("ticketPlaceholder")} enterKeyHint="next" disabled={pending} className={CONTROL} />
        </div>
        <div className="flex min-w-0 flex-col gap-item">
          <Label htmlFor="log-fnb" className="text-muted-foreground">{t("food")}</Label>
          <MoneyInput id="log-fnb" value={fnb} onValueChange={setFnb} placeholder={t("foodPlaceholder")} enterKeyHint="next" disabled={pending} className={CONTROL} />
        </div>
        <div className="flex min-w-0 flex-col gap-item">
          <Label htmlFor="log-other" className="text-muted-foreground">{t("other")}</Label>
          <MoneyInput id="log-other" value={other} onValueChange={setOther} placeholder={t("otherPlaceholder")} enterKeyHint="next" disabled={pending} className={CONTROL} />
        </div>
      </div>

      <div className="flex flex-col gap-item">
        <Label htmlFor="log-note" className="text-muted-foreground">{t("note")}</Label>
        <Input id="log-note" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("notePlaceholder")} enterKeyHint="done" disabled={pending} className={CONTROL} />
      </div>

      <div aria-hidden className="h-save-clear shrink-0" />
      <div data-save-bar className="pointer-events-none fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-background via-background/90 to-transparent px-inset pt-inset pb-(--inset-bottom)">
        <div className="mx-auto flex max-w-form items-center">
          <Button type="submit" size="cta" disabled={pending} className="pointer-events-auto min-w-0 flex-1">
            {pending ? <LoaderIcon className="motion-safe:animate-spin" aria-hidden /> : <PlaneIcon aria-hidden />}
            {pending ? t("submitting") : t("submit")}
          </Button>
        </div>
      </div>
    </form>
  );
}
