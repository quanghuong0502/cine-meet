"use client";

import { ExternalLink, Play, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Dialog } from "radix-ui";
import { Button } from "@/components/ui/button";
import { youtubeEmbedUrl, youtubeWatchUrl } from "@/lib/movie/youtube";

type LockableOrientation = ScreenOrientation & { lock?: (orientation: "landscape") => Promise<void> };

/** Takes the stage full screen where the browser allows it (not iPhone) and, if it can, holds the screen in landscape. Never throws. */
function enterFullscreen(stage: HTMLElement) {
  if (typeof stage.requestFullscreen !== "function") return;
  stage
    .requestFullscreen()
    .then(() => (screen.orientation as LockableOrientation | undefined)?.lock?.("landscape"))
    .catch(() => undefined);
}

function leaveFullscreen() {
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
  (screen.orientation as { unlock?: () => void } | undefined)?.unlock?.();
}

/**
 * A "Watch trailer" button that opens the trailer on a full-screen black stage, and asks the device for real full screen.
 * - Where the Fullscreen API works (Android, iPad, desktop) the stage goes full screen at once and is locked to landscape if allowed.
 * - iPhone does not let a page take an iframe full screen. There the player is told not to play inline (`playsinline=0`), so the
 *   first tap on YouTube's play button starts the video in iOS's own full-screen player. iOS also blocks a video from starting by
 *   itself inside an iframe, so that one tap cannot be skipped.
 * The player exists only while open, and closing stops it. Some channels forbid embedding, so "Watch on YouTube" is always in the bar.
 */
export function TrailerPlayer({ videoId, title }: { videoId: string; title: string }) {
  const t = useTranslations("movie.trailer");
  return (
    <Dialog.Root onOpenChange={(open) => { if (!open) leaveFullscreen(); }}>
      <Dialog.Trigger asChild>
        <Button type="button" variant="outline" size="pill" className="h-target self-start px-4 text-sm" aria-label={t("play", { title })}>
          <Play aria-hidden className="fill-current" />
          {t("watch")}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => enterFullscreen(event.currentTarget as HTMLElement)}
          className="fixed inset-0 z-50 flex flex-col bg-black pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] text-white outline-none"
        >
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
          <div className="flex min-h-0 flex-1 items-center justify-center bg-black">
            <iframe
              src={youtubeEmbedUrl(videoId)}
              title={t("playerTitle", { title })}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              className="aspect-video max-h-full w-full border-0"
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
