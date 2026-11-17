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

let loading: Promise<YtNamespace> | null = null;

/** Adds the API script on first use; every later call shares the same promise. Rejects when the script cannot be loaded. */
export function loadYouTubeApi(): Promise<YtNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  loading ??= new Promise<YtNamespace>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT) resolve(window.YT);
      else reject(new Error("YouTube API missing"));
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => {
      loading = null;
      reject(new Error("YouTube API failed to load"));
    };
    document.head.appendChild(script);
  });
  return loading;
}
