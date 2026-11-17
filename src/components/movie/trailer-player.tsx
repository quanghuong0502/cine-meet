"use client";

import { ExternalLink, Play, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Dialog } from "radix-ui";
import { Button } from "@/components/ui/button";
import { youtubeEmbedUrl, youtubeWatchUrl } from "@/lib/movie/youtube";

/**
 * A "Watch trailer" button that opens the trailer in a dialog in the middle of the screen, over a dimmed overlay (tap the overlay
 * or the X to close). The player (youtube-nocookie, `playsinline` so iPhone plays it in the page) exists only while the dialog is open,
 * so closing stops it; YouTube's own button takes it full screen. Some channels forbid embedding, so "Watch on YouTube" is always there.
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
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/75 supports-backdrop-filter:backdrop-blur-xs" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 flex-col gap-2 rounded-xl border bg-popover p-3 text-popover-foreground outline-none"
        >
          <div className="flex items-center gap-2">
            <Dialog.Title className="min-w-0 flex-1 truncate pl-1 text-base font-semibold">{t("playerTitle", { title })}</Dialog.Title>
            <Dialog.Close asChild>
              <Button type="button" variant="ghost" size="icon" className="shrink-0 rounded-full" aria-label={t("close")}>
                <X aria-hidden className="size-6" />
              </Button>
            </Dialog.Close>
          </div>
          <div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-black">
            <iframe
              src={youtubeEmbedUrl(videoId)}
              title={t("playerTitle", { title })}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              className="absolute inset-0 size-full border-0"
            />
          </div>
          <Button asChild variant="ghost" className="h-target self-start text-muted-foreground">
            <a href={youtubeWatchUrl(videoId)} target="_blank" rel="noopener noreferrer">
              <ExternalLink aria-hidden />
              {t("openYoutube")}
            </a>
          </Button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
