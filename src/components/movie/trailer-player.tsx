"use client";

import { ExternalLink, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { useTranslations } from "next-intl";
import { Dialog } from "radix-ui";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { youtubeEmbedUrl, youtubeWatchUrl } from "@/lib/movie/youtube";
import { loadYouTubeApi, YT_STATE, type YtPlayer } from "@/lib/movie/youtube-api";

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

/** 83 seconds as "1:23". */
function clock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/**
 * The player on a black stage, with our own controls instead of YouTube's bar (`controls=0`, driven through the IFrame API):
 * play or pause (also a tap on the video), a seek bar with the time, and mute.
 * - Until the video has started, YouTube's own play button and title are what is on screen and a tap goes to them: iOS only lets a
 *   video start from a tap inside the player, so a button of ours could not start it. Our controls and tap layer appear once it plays.
 * - If the API cannot load, the player is reloaded with YouTube's own bar, so there is always a way to pause.
 * - An iframe is white until it has loaded, which flashes on the dark overlay, so it stays invisible until `onLoad` and fades in.
 *   `sandbox` leaves out popups and navigating the page, so YouTube's logo or title inside the player goes nowhere; the only way out
 *   to YouTube is the "Watch on YouTube" link. It mounts with the dialog, so every opening starts again from black.
 */
function Player({ videoId, title }: { videoId: string; title: string }) {
  const t = useTranslations("movie.trailer");
  const frame = useRef<HTMLIFrameElement>(null);
  const player = useRef<YtPlayer | null>(null);
  const scrubbing = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const [apiFailed, setApiFailed] = useState(false);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [time, setTime] = useState({ current: 0, duration: 0 });
  const [origin] = useState(() => (typeof window === "undefined" ? undefined : window.location.origin));

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    loadYouTubeApi()
      .then((yt) => {
        const element = frame.current;
        if (cancelled || !element) return;
        player.current = new yt.Player(element, {
          events: {
            onReady: () => {
              if (!cancelled) setMuted(player.current?.isMuted() ?? false);
            },
            onStateChange: ({ data }) => {
              if (cancelled) return;
              if (data === YT_STATE.playing) {
                setStarted(true);
                setPlaying(true);
              } else if (data === YT_STATE.paused || data === YT_STATE.ended) setPlaying(false);
            },
          },
        });
        timer = setInterval(() => {
          const current = player.current;
          if (cancelled || !current || scrubbing.current) return;
          setTime({ current: current.getCurrentTime?.() ?? 0, duration: current.getDuration?.() ?? 0 });
        }, 250);
      })
      .catch(() => {
        if (cancelled) return;
        setLoaded(false);
        setApiFailed(true);
      });
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      // The iframe goes away with the dialog; destroying the player would remove it from under React.
      player.current = null;
    };
  }, [videoId]);

  const toggle = () => (playing ? player.current?.pauseVideo() : player.current?.playVideo());
  const toggleMute = () => {
    if (!player.current) return;
    if (muted) player.current.unMute();
    else player.current.mute();
    setMuted(!muted);
  };

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black shadow-2xl">
      <iframe
        key={apiFailed ? "own-bar" : "our-bar"}
        ref={frame}
        src={youtubeEmbedUrl(videoId, apiFailed ? { controls: true } : { controls: false, origin })}
        title={title}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        sandbox="allow-scripts allow-same-origin allow-presentation"
        referrerPolicy="strict-origin-when-cross-origin"
        onLoad={() => setLoaded(true)}
        style={{ colorScheme: "dark" }}
        className={`absolute inset-0 size-full border-0 bg-black transition-opacity duration-300 motion-reduce:transition-none ${loaded ? "opacity-100" : "opacity-0"}`}
      />
      {started && !apiFailed ? (
        <>
          <button type="button" onClick={toggle} aria-label={playing ? t("pause") : t("resume")} className="absolute inset-0 outline-none" />
          <div className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/80 to-transparent px-1 pt-6">
            <Button type="button" variant="ghost" size="icon" onClick={toggle} aria-label={playing ? t("pause") : t("resume")} className="shrink-0 rounded-full text-white hover:bg-white/15 hover:text-white">
              {playing ? <Pause aria-hidden className="size-6 fill-current" /> : <Play aria-hidden className="size-6 fill-current" />}
            </Button>
            <span className="w-10 shrink-0 text-right text-xs text-white tabular-nums">{clock(time.current)}</span>
            <Slider
              aria-label={t("seek")}
              min={0}
              max={Math.max(1, Math.floor(time.duration))}
              step={1}
              value={[Math.min(Math.floor(time.current), Math.max(1, Math.floor(time.duration)))]}
              onValueChange={([value]) => {
                scrubbing.current = true;
                setTime((previous) => ({ ...previous, current: value ?? 0 }));
              }}
              onValueCommit={([value]) => {
                player.current?.seekTo(value ?? 0, true);
                scrubbing.current = false;
              }}
              className="min-w-0 flex-1"
            />
            <span className="w-10 shrink-0 text-xs text-white/70 tabular-nums">{clock(time.duration)}</span>
            <Button type="button" variant="ghost" size="icon" onClick={toggleMute} aria-label={muted ? t("unmute") : t("mute")} className="shrink-0 rounded-full text-white hover:bg-white/15 hover:text-white">
              {muted ? <VolumeX aria-hidden className="size-6" /> : <Volume2 aria-hidden className="size-6" />}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
