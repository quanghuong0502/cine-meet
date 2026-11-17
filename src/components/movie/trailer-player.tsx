"use client";

import { ExternalLink, Play, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Dialog } from "radix-ui";
import { Button } from "@/components/ui/button";
import { youtubeEmbedUrl, youtubeWatchUrl } from "@/lib/movie/youtube";

/**
 * A "Watch trailer" button that opens the trailer on a full-screen black stage. The stage is a landscape canvas (`trailer-stage`,
 * globals.css): a phone held upright shows it turned a quarter turn, so the video fills the long side of the screen (about twice as big
 * as a 16:9 video across the width of a portrait phone) and the person turns the phone to watch. If the phone itself is in landscape,
 * the stage is simply upright. The player (youtube-nocookie, `playsinline`) exists only while open, and closing stops it.
 * Some channels forbid embedding, so "Watch on YouTube" is always in the bar.
 */
export function TrailerPlayer({ videoId, title }: { videoId: string; title: string }) {
  const t = useTranslations("movie.trailer");
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button type="button" variant="outline" size="pill" className="h-target self-start px-4 text-sm" aria-label={t("play", { title })}>
          <Play aria-hidden className="fill-current" />
          {t("watch")}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Content aria-describedby={undefined} className="trailer-stage z-50 flex flex-col bg-black text-white outline-none">
          <div className="flex shrink-0 items-center gap-2 px-2">
            <Dialog.Close asChild>
              <Button type="button" variant="ghost" size="icon" className="shrink-0 rounded-full text-white hover:bg-white/15 hover:text-white" aria-label={t("close")}>
                <X aria-hidden className="size-6" />
              </Button>
            </Dialog.Close>
            <Dialog.Title className="min-w-0 flex-1 truncate text-sm">{t("playerTitle", { title })}</Dialog.Title>
            <Button asChild variant="ghost" className="h-target shrink-0 rounded-full px-3 text-sm text-white hover:bg-white/15 hover:text-white">
              <a href={youtubeWatchUrl(videoId)} target="_blank" rel="noopener noreferrer">
                <ExternalLink aria-hidden />
                {t("openYoutube")}
              </a>
            </Button>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <iframe
              src={youtubeEmbedUrl(videoId)}
              title={t("playerTitle", { title })}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              className="aspect-video h-full max-w-full border-0"
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
