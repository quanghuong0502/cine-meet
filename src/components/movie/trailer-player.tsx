"use client";

import { PlayIcon } from "@solar-icons/react/bold";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const LazyTrailerDialog = dynamic(
  () => import("@/components/movie/trailer-dialog").then((m) => m.TrailerDialog),
  { ssr: false },
);

/**
 * Lightweight trigger button on `/movies/[id]`: keeps Radix Dialog, Slider, and the YouTube IFrame API
 * (~98.6 KB raw) completely out of the initial page bundle until the user clicks "Watch trailer".
 */
export function TrailerPlayer({ videoId, title }: { videoId: string; title: string }) {
  const t = useTranslations("movie.trailer");
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="cta-sm"
        aria-label={t("play", { title })}
        onClick={() => setOpen(true)}
      >
        <PlayIcon aria-hidden />
        {t("watch")}
      </Button>
      {open ? <LazyTrailerDialog open={open} onOpenChange={setOpen} videoId={videoId} title={title} /> : null}
    </>
  );
}
