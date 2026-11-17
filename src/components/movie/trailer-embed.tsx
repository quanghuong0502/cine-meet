"use client";

import { ExternalLink, Play } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { youtubeEmbedUrl, youtubeThumbnailUrl, youtubeWatchUrl } from "@/lib/movie/youtube";

/**
 * Trailer as a "lite embed": only the thumbnail loads with the page; the player (youtube-nocookie, `playsinline` so iPhone plays it
 * in the page) loads when the person taps. Some channels forbid embedding, so "Watch on YouTube" is always there as the way out.
 */
export function TrailerEmbed({ videoId, title }: { videoId: string; title: string }) {
  const t = useTranslations("movie.trailer");
  const [playing, setPlaying] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <div className="relative aspect-video w-full overflow-hidden rounded-xl border bg-black">
        {playing ? (
          <iframe
            src={youtubeEmbedUrl(videoId)}
            title={t("playerTitle", { title })}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="absolute inset-0 size-full border-0"
          />
        ) : (
          <button type="button" onClick={() => setPlaying(true)} aria-label={t("play", { title })} className="group absolute inset-0 size-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <Image src={youtubeThumbnailUrl(videoId)} alt="" fill sizes="(max-width: 672px) 100vw, 672px" unoptimized className="object-cover" />
            <span aria-hidden className="absolute inset-0 bg-black/25" />
            <span aria-hidden className="absolute top-1/2 left-1/2 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
              <Play className="size-7 translate-x-0.5 fill-current" />
            </span>
          </button>
        )}
      </div>
      <Button asChild variant="ghost" size="sm" className="h-target self-start text-muted-foreground">
        <a href={youtubeWatchUrl(videoId)} target="_blank" rel="noopener noreferrer">
          <ExternalLink aria-hidden />
          {t("openYoutube")}
        </a>
      </Button>
    </div>
  );
}
