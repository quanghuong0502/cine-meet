"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { reviewAuditoriumAction } from "@/actions/ratings";
import { StarRating } from "@/components/star-rating";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { AuditoriumReviewInput } from "@/services/rating.service";

/** This person's own review of the room (design 3.2): sound, air conditioning, cleanliness, each 1-5, and a comment. Submitting again replaces it. */
export function RoomReviewForm({ auditoriumId, initial }: { auditoriumId: string; initial: AuditoriumReviewInput | null }) {
  const t = useTranslations("cinemas.room.review");
  const [sound, setSound] = useState(initial?.sound ?? 0);
  const [ac, setAc] = useState(initial?.ac ?? 0);
  const [cleanliness, setCleanliness] = useState(initial?.cleanliness ?? 0);
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [pending, start] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (sound === 0 || ac === 0 || cleanliness === 0) {
      toast.error(t("needAllStars"));
      return;
    }
    start(async () => {
      const result = await reviewAuditoriumAction({ auditoriumId, sound: String(sound), ac: String(ac), cleanliness: String(cleanliness), comment }).catch(() => null);
      if (!result?.ok) {
        toast.error(t("error"));
        return;
      }
      toast.success(t("saved"));
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-item rounded-xl border bg-card p-inset-sm">
      <h2 className="type-heading">{t("title")}</h2>
      <div className="flex items-center justify-between gap-item">
        <span className="type-secondary">{t("sound")}</span>
        <StarRating label={t("sound")} value={sound} onChange={setSound} disabled={pending} />
      </div>
      <div className="flex items-center justify-between gap-item">
        <span className="type-secondary">{t("ac")}</span>
        <StarRating label={t("ac")} value={ac} onChange={setAc} disabled={pending} />
      </div>
      <div className="flex items-center justify-between gap-item">
        <span className="type-secondary">{t("cleanliness")}</span>
        <StarRating label={t("cleanliness")} value={cleanliness} onChange={setCleanliness} disabled={pending} />
      </div>
      <Textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} placeholder={t("commentPlaceholder")} className="rounded-xl bg-background px-inset type-body" />
      <Button type="submit" size="cta" disabled={pending}>
        {t("save")}
      </Button>
    </form>
  );
}
