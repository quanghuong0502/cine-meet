"use client";

import { ExternalLink, Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { Dialog } from "radix-ui";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { youtubeEmbedUrl, youtubeWatchUrl } from "@/lib/movie/youtube";

/**
 * A "Watch trailer" button that opens the trailer in the middle of the screen, straight on a dimmed overlay with no card around it
 * (tap the overlay or press Esc to close; no title and no X, only the video). The player (youtube-nocookie, `playsinline` so iPhone plays it in the page) exists only while the dialog is open,
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
          className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-3rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 flex-col gap-3 text-white outline-none"
        >
          {/* Not drawn (the video says what it is); a dialog still needs a name for screen readers. */}
          <Dialog.Title className="sr-only">{t("playerTitle", { title })}</Dialog.Title>
          <Player videoId={videoId} title={t("playerTitle", { title })} />
          <Button asChild variant="ghost" className="h-target self-start text-white/80 hover:bg-white/15 hover:text-white">
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

/**
 * The player on a black stage. An iframe is white until it has loaded, which flashes on the dark overlay, so it stays invisible until
 * `onLoad` and fades in. `sandbox` leaves out popups and navigating the page, so a tap on YouTube's logo or title inside the player
 * goes nowhere; the only way out to YouTube is the "Watch on YouTube" link. It mounts with the dialog, so every opening starts black again.
 */
function Player({ videoId, title }: { videoId: string; title: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black shadow-2xl">
      <iframe
        src={youtubeEmbedUrl(videoId)}
        title={title}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        sandbox="allow-scripts allow-same-origin allow-presentation"
        referrerPolicy="strict-origin-when-cross-origin"
        onLoad={() => setLoaded(true)}
        style={{ colorScheme: "dark" }}
        className={`absolute inset-0 size-full border-0 bg-black transition-opacity duration-300 motion-reduce:transition-none ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}
