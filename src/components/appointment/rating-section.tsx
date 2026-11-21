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
    setMovieRating(rating);
    startMovie(async () => {
      const result = await rateMovieAction({ movieId: view.movie.id, rating: String(rating) }).catch(() => null);
      if (!result?.ok) toast.error(t("error"));
    });
  }

  function saveSeat(seatCode: string, rating: number) {
    setSeatRatings((prev) => ({ ...prev, [seatCode]: rating }));
    const auditoriumId = view.auditoriumId;
    const layoutId = view.layoutId;
    if (!auditoriumId || !layoutId) return;
    startSeat(async () => {
      const result = await rateSeatAction({ auditoriumId, layoutId, seatCode, rating: String(rating), appointmentId: view.id }).catch(() => null);
      if (!result?.ok) toast.error(t("error"));
    });
  }

  return (
    <section aria-labelledby="appt-rating" className="flex flex-col gap-item rounded-xl border bg-card p-inset-sm">
      <h2 id="appt-rating" className="type-heading">
        {t("title")}
      </h2>
      <div className="flex items-center justify-between gap-item">
        <span className="type-secondary">{t("movie")}</span>
        <StarRating label={t("movie")} value={movieRating} onChange={saveMovie} disabled={moviePending} />
      </div>
      {mySeats.map((seatCode) => (
        <div key={seatCode} className="flex items-center justify-between gap-item">
          <span className="type-secondary">{t("seat", { seatCode })}</span>
          <StarRating label={t("seat", { seatCode })} value={seatRatings[seatCode] ?? 0} onChange={(v) => saveSeat(seatCode, v)} disabled={seatPending} />
        </div>
      ))}
    </section>
  );
}
