/**
 * Just enough of the YouTube IFrame Player API (https://developers.google.com/youtube/iframe_api_reference) to drive the trailer
 * from our own controls: the types we use, and a loader that adds the API script once.
 */
export interface YtPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  mute(): void;
  unMute(): void;
  isMuted(): boolean;
  getCurrentTime(): number;
  getDuration(): number;
}

interface YtNamespace {
  Player: new (
    iframe: HTMLIFrameElement,
    options: { events: { onReady?: () => void; onStateChange?: (event: { data: number }) => void } },
  ) => YtPlayer;
}

declare global {
  interface Window {
    YT?: YtNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

/** `onStateChange` values. */
export const YT_STATE = { ended: 0, playing: 1, paused: 2, buffering: 3, cued: 5 } as const;

const LOAD_TIMEOUT_MS = 6_000;
let loading: Promise<YtNamespace> | null = null;

/** Adds the API script on first use; every later call shares the same promise. Rejects (with cleanup & timeout) when blocked. */
export function loadYouTubeApi(): Promise<YtNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  loading ??= new Promise<YtNamespace>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    const script = document.createElement("script");
    let settled = false;

    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      window.onYouTubeIframeAPIReady = previous;
      script.remove();
      loading = null;
      reject(new Error(message));
    };

    const timer = setTimeout(() => fail("YouTube API timed out"), LOAD_TIMEOUT_MS);

    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (window.YT) resolve(window.YT);
      else {
        loading = null;
        reject(new Error("YouTube API missing"));
      }
    };

    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => fail("YouTube API failed to load");
    document.head.appendChild(script);
  });
  return loading;
}
