"use client";

import { PauseIcon, PlayIcon } from "@solar-icons/react/bold";
import { CloseIcon, FullScreenIcon, LoaderIcon, QuitFullScreenIcon, SquareTopDownIcon, VolumeCrossIcon, VolumeLoudIcon } from "@solar-icons/react/line-duotone";
import { useTranslations } from "next-intl";
import { Dialog } from "radix-ui";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { youtubeEmbedUrl, youtubeWatchUrl } from "@/lib/movie/youtube";
import { loadYouTubeApi, YT_STATE, type YtPlayer } from "@/lib/movie/youtube-api";

export function TrailerDialog({
  open,
  onOpenChange,
  videoId,
  title,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoId: string;
  title: string;
}) {
  const t = useTranslations("movie.trailer");
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/85" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-50 m-auto flex h-fit max-h-[calc(100dvh-2*var(--spacing-inset))] w-[calc(100%-2*var(--spacing-inset))] max-w-media flex-col gap-item text-white outline-none"
        >
          <div className="flex items-center justify-between gap-stack">
            <Dialog.Title className="min-w-0 flex-1 truncate type-item-title text-white">{t("playerTitle", { title })}</Dialog.Title>
            <Dialog.Close asChild>
              <Button type="button" variant="ghost" size="icon" aria-label={t("close")} className="shrink-0 rounded-full text-white hover:bg-white/15 hover:text-white">
                <CloseIcon className="size-icon-lg" aria-hidden />
              </Button>
            </Dialog.Close>
          </div>
          <Player videoId={videoId} title={t("playerTitle", { title })} />
          <Button asChild variant="ghost" size="sm" className="self-start text-white/80 hover:bg-white/15 hover:text-white">
            <a href={youtubeWatchUrl(videoId)} target="_blank" rel="noopener noreferrer">
              <SquareTopDownIcon aria-hidden />
              {t("openYoutube")}
            </a>
          </Button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function isAppleTouchDevice(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes("Mac") && navigator.maxTouchPoints > 1);
}

function clock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

function Player({ videoId, title }: { videoId: string; title: string }) {
  const t = useTranslations("movie.trailer");
  const stage = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const player = useRef<YtPlayer | null>(null);
  const scrubbing = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const [nudge, setNudge] = useState(false);
  const [apiFailed, setApiFailed] = useState(false);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [barVisible, setBarVisible] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [time, setTime] = useState({ current: 0, duration: 0 });
  const [origin] = useState(() => (typeof window === "undefined" ? undefined : window.location.origin));

  useEffect(() => {
    let cancelled = false;
    loadYouTubeApi()
      .then((yt) => {
        const element = frame.current;
        if (cancelled || !element) return;
        player.current = new yt.Player(element, {
          events: {
            onReady: () => {
              if (cancelled) return;
              setMuted(player.current?.isMuted() ?? false);
              const duration = Math.floor(player.current?.getDuration?.() ?? 0);
              if (duration > 0) setTime((prev) => (prev.duration === duration ? prev : { ...prev, duration }));
            },
            onStateChange: ({ data }) => {
              if (cancelled) return;
              if (data === YT_STATE.playing) {
                setStarted(true);
                setPlaying(true);
                setBarVisible(true);
              } else if (data === YT_STATE.paused || data === YT_STATE.ended) {
                setPlaying(false);
              }
            },
          },
        });
      })
      .catch(() => {
        if (cancelled) return;
        setLoaded(false);
        setApiFailed(true);
      });
    return () => {
      cancelled = true;
      player.current = null;
    };
  }, [videoId]);

  // Only poll playback time while actively playing, and skip React re-renders when the whole-second readout is unchanged.
  useEffect(() => {
    if (!playing) return;
    const sync = () => {
      const current = player.current;
      if (!current || scrubbing.current) return;
      const cur = Math.floor(current.getCurrentTime?.() ?? 0);
      const dur = Math.floor(current.getDuration?.() ?? 0);
      setTime((prev) => (prev.current === cur && prev.duration === dur ? prev : { current: cur, duration: dur }));
    };
    sync();
    const timer = setInterval(sync, 250);
    return () => clearInterval(timer);
  }, [playing]);

  useEffect(() => {
    const element = stage.current;
    const onChange = () => setNativeFullscreen(document.fullscreenElement === element);
    document.addEventListener("fullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      if (document.fullscreenElement === element) void document.exitFullscreen().catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    const element = box.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const observer = new ResizeObserver(() => {
      timers.splice(0).forEach(clearTimeout);
      timers.push(setTimeout(() => setNudge(true), 150), setTimeout(() => setNudge(false), 270));
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      timers.forEach(clearTimeout);
    };
  }, []);

  const fullscreen = nativeFullscreen || expanded;
  const showBar = !fullscreen || !playing || barVisible;

  function showBarForAWhile() {
    clearTimeout(hideTimer.current);
    setBarVisible(true);
    if (fullscreen && playing) hideTimer.current = setTimeout(() => setBarVisible(false), 3000);
  }

  useEffect(() => {
    if (fullscreen && playing) hideTimer.current = setTimeout(() => setBarVisible(false), 3000);
    return () => clearTimeout(hideTimer.current);
  }, [fullscreen, playing]);

  function toggleFullscreen() {
    setBarVisible(true);
    const element = stage.current;
    if (nativeFullscreen) {
      void document.exitFullscreen().catch(() => undefined);
    } else if (expanded) {
      setExpanded(false);
    } else if (element && !isAppleTouchDevice() && document.fullscreenEnabled && typeof element.requestFullscreen === "function") {
      element.requestFullscreen().then(
        () => {
          const orientation = screen.orientation as (ScreenOrientation & { lock?: (orientation: "landscape") => Promise<void> }) | undefined;
          void orientation?.lock?.("landscape")?.catch(() => undefined);
        },
        () => setExpanded(true),
      );
    } else {
      setExpanded(true);
    }
  }

  const toggle = () => (playing ? player.current?.pauseVideo() : player.current?.playVideo());
  const toggleMute = () => {
    if (!player.current) return;
    if (muted) player.current.unMute();
    else player.current.mute();
    setMuted(!muted);
  };

  return (
    <div
      ref={stage}
      className={cn(
        "w-full [&:fullscreen]:flex [&:fullscreen]:items-center [&:fullscreen]:justify-center [&:fullscreen]:bg-black",
        expanded && "fixed inset-0 z-60 flex items-center justify-center bg-black px-[max(env(safe-area-inset-left),env(safe-area-inset-right))]",
      )}
    >
      <div ref={box} className={cn("relative aspect-video overflow-hidden bg-black", fullscreen ? "w-[min(100%,calc(100dvh*16/9))]" : "w-full rounded-xl shadow-2xl")}>
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
          style={{
            colorScheme: "dark",
            left: "calc(env(safe-area-inset-left) * -1)",
            width: `calc(100% + env(safe-area-inset-left) + env(safe-area-inset-right) - ${nudge ? 1 : 0}px)`,
          }}
          className={`absolute top-0 h-full border-0 bg-black transition-opacity duration-300 motion-reduce:transition-none ${loaded ? "opacity-100" : "opacity-0"}`}
        />
        {!loaded ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <LoaderIcon className="size-icon-lg text-white/70 motion-safe:animate-spin" aria-hidden />
          </div>
        ) : null}
        {started && !apiFailed ? (
          <>
            <button
              type="button"
              onClick={() => {
                if (!fullscreen) toggle();
                else if (barVisible) {
                  clearTimeout(hideTimer.current);
                  setBarVisible(false);
                } else showBarForAWhile();
              }}
              aria-label={fullscreen ? (barVisible ? t("hideControls") : t("showControls")) : playing ? t("pause") : t("resume")}
              className="absolute inset-0 outline-none"
            />
            <div
              onPointerDownCapture={showBarForAWhile}
              className={cn(
                "absolute inset-x-0 bottom-0 flex flex-col gap-tight bg-gradient-to-t from-black/85 via-black/50 to-transparent px-inset-sm pt-inset-lg pb-tight transition-opacity duration-200 motion-reduce:transition-none",
                !showBar && "pointer-events-none opacity-0",
              )}
            >
              <div className="flex items-center gap-stack">
                <span className="shrink-0 type-micro text-white tabular-nums">{clock(time.current)}</span>
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
                  className="min-w-0 flex-1 [&_[data-slot=slider-track]]:bg-white/30"
                />
                <span className="shrink-0 type-micro text-white/70 tabular-nums">{clock(time.duration)}</span>
              </div>
              <div className="flex items-center justify-between gap-stack">
                <Button type="button" variant="ghost" size="icon" onClick={toggle} aria-label={playing ? t("pause") : t("resume")} className="shrink-0 rounded-full text-white hover:bg-white/15 hover:text-white">
                  {playing ? <PauseIcon aria-hidden className="size-icon-lg" /> : <PlayIcon aria-hidden className="size-icon-lg" />}
                </Button>
                <div className="flex items-center gap-stack">
                  <Button type="button" variant="ghost" size="icon" onClick={toggleMute} aria-label={muted ? t("unmute") : t("mute")} className="shrink-0 rounded-full text-white hover:bg-white/15 hover:text-white">
                    {muted ? <VolumeCrossIcon aria-hidden className="size-icon-lg" /> : <VolumeLoudIcon aria-hidden className="size-icon-lg" />}
                  </Button>
                  <Button type="button" variant="ghost" size="icon" onClick={toggleFullscreen} aria-label={fullscreen ? t("exitFullscreen") : t("fullscreen")} className="shrink-0 rounded-full text-white hover:bg-white/15 hover:text-white">
                    {fullscreen ? <QuitFullScreenIcon aria-hidden className="size-icon-lg" /> : <FullScreenIcon aria-hidden className="size-icon-lg" />}
                  </Button>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
