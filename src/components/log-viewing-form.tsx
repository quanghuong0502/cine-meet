"use client";

import { LoaderCircle, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { logManualViewingAction } from "@/actions/expenses";
import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/money-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RequiredMark } from "@/components/required-mark";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { vietnamToday } from "@/lib/movie/status";

const CONTROL = "h-control rounded-xl bg-card px-inset type-body";

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

  function submit(event: React.FormEvent) {
    event.preventDefault();
    start(async () => {
      const result = await logManualViewingAction({ movieId, auditoriumId, date, ticket, fnb, other, note }).catch(() => null);
      if (!result?.ok) {
        if (result?.error === "future_date") {
          toast.error(t("futureDate"));
        } else {
          toast.error(t("error"));
        }
        return;
      }
      toast.success(t("saved"));
      router.push("/");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-1 flex-col gap-field">
      <div className="flex flex-col gap-item">
        <Label htmlFor="log-date">
          {t("date")} <RequiredMark />
        </Label>
        <Input id="log-date" type="date" required value={date} max={vietnamToday()} onChange={(e) => setDate(e.target.value)} className={CONTROL} />
      </div>
      <div className="flex flex-col gap-item">
        <Label htmlFor="log-movie">{t("movie")}</Label>
        <Select value={movieId} onValueChange={setMovieId}>
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
        <Label htmlFor="log-room">{t("room")}</Label>
        <Select value={auditoriumId} onValueChange={setAuditoriumId}>
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
      <div className="flex gap-stack">
        <div className="flex min-w-0 flex-1 flex-col gap-item">
          <Label htmlFor="log-ticket">{t("ticket")}</Label>
          <MoneyInput id="log-ticket" value={ticket} onValueChange={setTicket} className={CONTROL} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-item">
          <Label htmlFor="log-fnb">{t("food")}</Label>
          <MoneyInput id="log-fnb" value={fnb} onValueChange={setFnb} className={CONTROL} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-item">
          <Label htmlFor="log-other">{t("other")}</Label>
          <MoneyInput id="log-other" value={other} onValueChange={setOther} className={CONTROL} />
        </div>
      </div>
      <div className="flex flex-col gap-item">
        <Label htmlFor="log-note">{t("note")}</Label>
        <Input id="log-note" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} className={CONTROL} />
      </div>

      <div aria-hidden className="h-save-clear shrink-0" />
      <div data-save-bar className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-inset pb-(--inset-bottom)">
        <div className="mx-auto flex max-w-form items-center">
          <Button type="submit" size="cta" disabled={pending} className="pointer-events-auto min-w-0 flex-1">
            {pending ? <LoaderCircle className="motion-safe:animate-spin" aria-hidden /> : <Send aria-hidden />}
            {t("submit")}
          </Button>
        </div>
      </div>
    </form>
  );
}
