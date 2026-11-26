"use client";

import { DangerCircleIcon, LoaderIcon } from "@solar-icons/react/line-duotone";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { reviewAuditoriumAction } from "@/actions/ratings";
import { StarRating } from "@/components/star-rating";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { AuditoriumReviewInput } from "@/services/rating.service";

/** This person's own review of the room (design 3.2): sound, air conditioning, cleanliness, each 1-5, and a comment. Submitting again replaces it. */
export function RoomReviewForm({ auditoriumId, initial }: { auditoriumId: string; initial: AuditoriumReviewInput | null }) {
  const t = useTranslations("cinemas.room.review");
  const tc = useTranslations("confirmDialog");
  const [sound, setSound] = useState(initial?.sound ?? 0);
  const [ac, setAc] = useState(initial?.ac ?? 0);
  const [cleanliness, setCleanliness] = useState(initial?.cleanliness ?? 0);
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [submitted, setSubmitted] = useState(false);
  const [pending, start] = useTransition();

  const missingAll = submitted && (sound === 0 || ac === 0 || cleanliness === 0);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (sound === 0 || ac === 0 || cleanliness === 0) return;
    start(async () => {
      const result = await reviewAuditoriumAction({ auditoriumId, sound: String(sound), ac: String(ac), cleanliness: String(cleanliness), comment }).catch(() => null);
      if (!result?.ok) {
        toast.error(t("error"));
        return;
      }
      setSubmitted(false);
      toast.success(t("saved"));
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-group rounded-xl border bg-card p-inset">
      <h2 className="type-heading">{t("title")}</h2>
      {missingAll ? (
        <p role="alert" className="flex items-start gap-stack rounded-xl border border-destructive/30 bg-destructive/10 px-inset py-inset-sm type-secondary text-destructive">
          <DangerCircleIcon className="mt-hair size-icon-sm shrink-0" aria-hidden />
          {t("needAllStars")}
        </p>
      ) : null}
      <div className="flex flex-col gap-tight">
        <span className={cn("type-label", submitted && sound === 0 && "text-destructive")}>{t("sound")}</span>
        <StarRating label={t("sound")} value={sound} onChange={setSound} disabled={pending} />
      </div>
      <div className="flex flex-col gap-tight">
        <span className={cn("type-label", submitted && ac === 0 && "text-destructive")}>{t("ac")}</span>
        <StarRating label={t("ac")} value={ac} onChange={setAc} disabled={pending} />
      </div>
      <div className="flex flex-col gap-tight">
        <span className={cn("type-label", submitted && cleanliness === 0 && "text-destructive")}>{t("cleanliness")}</span>
        <StarRating label={t("cleanliness")} value={cleanliness} onChange={setCleanliness} disabled={pending} />
      </div>
      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={500}
        disabled={pending}
        aria-label={t("commentPlaceholder")}
        placeholder={t("commentPlaceholder")}
        className="rounded-xl bg-background px-inset type-body"
      />
      <Button type="submit" size="cta" disabled={pending}>
        {pending ? <LoaderIcon className="motion-safe:animate-spin" aria-hidden /> : null}
        {pending ? tc("pending") : t("save")}
      </Button>
    </form>
  );
}
