"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { rateMovieAction, rateSeatAction } from "@/actions/ratings";
import { StarRating } from "@/components/star-rating";
import type { AppointmentView } from "@/services/appointment.service";

/**
 * After the viewing (design 3.4): the person rates the movie (once, personal only) and each seat of theirs for this
 * viewing. Only shown once COMPLETED, and only for seats this appointment's data says they actually sat in.
 */
export function RatingSection({ view, initialMovieRating, initialSeatRatings }: { view: AppointmentView; initialMovieRating: number; initialSeatRatings: Record<string, number> }) {
  const t = useTranslations("appointments.detail.rating");
  const [moviePending, startMovie] = useTransition();
  const [seatPending, startSeat] = useTransition();
  const [movieRating, setMovieRating] = useState(initialMovieRating);
  const [seatRatings, setSeatRatings] = useState<Record<string, number>>(initialSeatRatings);
  const mySeats = [...new Set(view.seats.filter((s) => s.userId === view.viewerId).map((s) => s.seatCode))];

  function saveMovie(rating: number) {
    const previous = movieRating;
    setMovieRating(rating);
    startMovie(async () => {
      const result = await rateMovieAction({ movieId: view.movie.id, rating: String(rating) }).catch(() => null);
      if (!result?.ok) {
        setMovieRating(previous);
        toast.error(t("error"));
      }
    });
  }

  function saveSeat(seatCode: string, rating: number) {
    const auditoriumId = view.auditoriumId;
    const layoutId = view.layoutId;
    if (!auditoriumId || !layoutId) {
      toast.error(t("error"));
      return;
    }
    const previous = seatRatings[seatCode] ?? 0;
    setSeatRatings((prev) => ({ ...prev, [seatCode]: rating }));
    startSeat(async () => {
      const result = await rateSeatAction({ auditoriumId, layoutId, seatCode, rating: String(rating), appointmentId: view.id }).catch(() => null);
      if (!result?.ok) {
        setSeatRatings((prev) => ({ ...prev, [seatCode]: previous }));
        toast.error(t("error"));
      }
    });
  }

  return (
    <section aria-labelledby="appt-rating" className="flex flex-col gap-item">
      <h2 id="appt-rating" className="type-heading">
        {t("title")}
      </h2>
      <div className="flex flex-col gap-group rounded-xl border bg-card p-inset">
        <div className="flex flex-col gap-tight">
          <div className="flex items-center justify-between gap-stack">
            <span className="type-label">{t("movie")}</span>
            {movieRating > 0 ? <span className="type-caption text-muted-foreground tabular-nums">{movieRating}/5</span> : null}
          </div>
          <StarRating label={t("movie")} value={movieRating} onChange={saveMovie} disabled={moviePending} />
        </div>
        {mySeats.map((seatCode) => {
          const val = seatRatings[seatCode] ?? 0;
          return (
            <div key={seatCode} className="flex flex-col gap-tight">
              <div className="flex items-center justify-between gap-stack">
                <span className="type-label">{t("seat", { seatCode })}</span>
                {val > 0 ? <span className="type-caption text-muted-foreground tabular-nums">{val}/5</span> : null}
              </div>
              <StarRating label={t("seat", { seatCode })} value={val} onChange={(v) => saveSeat(seatCode, v)} disabled={seatPending} />
            </div>
          );
        })}
      </div>
    </section>
  );
}
