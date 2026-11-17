"use client";

import { ExternalLink, Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { youtubeEmbedUrl, youtubeWatchUrl } from "@/lib/movie/youtube";

/**
 * A "Watch trailer" button that opens the player in a bottom sheet, so the trailer takes no room on the page. The player
 * (youtube-nocookie, `playsinline` so iPhone plays it in the page) is only created while the sheet is open, and closing the sheet stops it.
 * Some channels forbid embedding, so "Watch on YouTube" is always there as the way out.
 */
export function TrailerSheet({ videoId, title }: { videoId: string; title: string }) {
  const t = useTranslations("movie.trailer");
  const [open, setOpen] = useState(false);
  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <Button type="button" variant="outline" size="pill" className="self-start" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={t("play", { title })}>
        <Play aria-hidden className="fill-current" />
        {t("watch")}
      </Button>
      <DrawerContent aria-describedby={undefined}>
        <DrawerHeader>
          <DrawerTitle className="text-xl font-semibold">{t("playerTitle", { title })}</DrawerTitle>
        </DrawerHeader>
        {/* Dragging inside the player must not drag the sheet. */}
        <div data-vaul-no-drag className="relative mx-4 aspect-video overflow-hidden rounded-xl border bg-black">
          <iframe
            src={youtubeEmbedUrl(videoId)}
            title={t("playerTitle", { title })}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="absolute inset-0 size-full border-0"
          />
        </div>
        <DrawerFooter className="pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button asChild variant="ghost" size="cta-sm">
            <a href={youtubeWatchUrl(videoId)} target="_blank" rel="noopener noreferrer">
              <ExternalLink aria-hidden />
              {t("openYoutube")}
            </a>
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
