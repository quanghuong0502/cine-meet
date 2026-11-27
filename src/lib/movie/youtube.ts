/** Extracts the 11-character YouTube video id from the links people paste (watch, youtu.be, shorts, embed, live, or the bare id). */
export function parseYoutubeId(input: string): string | null {
  const text = input.trim();
  if (/^[\w-]{11}$/.test(text)) return text;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, "");
  let id: string | null = null;
  if (host === "youtu.be") {
    id = url.pathname.split("/")[1] ?? null;
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") id = url.searchParams.get("v");
    else {
      const [, kind, value] = url.pathname.split("/");
      if (kind === "shorts" || kind === "embed" || kind === "live" || kind === "v") id = value ?? null;
    }
  }
  return id && /^[\w-]{11}$/.test(id) ? id : null;
}

export const YOUTUBE_EMBED_HOST = "https://www.youtube-nocookie.com";

export const youtubeThumbnailUrl = (videoId: string) => `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
/**
 * The player address. With `controls: false` YouTube draws no bar of its own (we draw ours, driven by the IFrame API, which needs
 * `enablejsapi` and our `origin`); without it the player keeps its own bar, as the way out when the API cannot load.
 */
export const youtubeEmbedUrl = (videoId: string, options: { controls: boolean; origin?: string } = { controls: true }) =>
  `${YOUTUBE_EMBED_HOST}/embed/${videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1&iv_load_policy=3` +
  (options.controls ? "" : `&controls=0&fs=0&disablekb=1&enablejsapi=1${options.origin ? `&origin=${encodeURIComponent(options.origin)}` : ""}`);

/**
 * Looping, chromeless embed URL for the 3D auditorium screen.
 * Preserves `enablejsapi=1`, `playsinline=1`, and optional `start` offset when resuming across fullscreen reparenting.
 */
export const youtubeScreenEmbedUrl = (
  videoId: string,
  options: { muted: boolean; origin?: string; startSeconds?: number },
) => {
  const start = options.startSeconds && options.startSeconds >= 1 ? `&start=${Math.floor(options.startSeconds)}` : "";
  return `${youtubeEmbedUrl(videoId, { controls: false, origin: options.origin })}&mute=${options.muted ? 1 : 0}&loop=1&playlist=${videoId}${start}`;
};

export interface YoutubeCoverLayout {
  width: number;
  height: number;
  left: number;
  top: number;
}

/**
 * Computes centered `object-fit: cover` dimensions for a 16:9 YouTube iframe inside an arbitrary cinema screen wrapper
 * (e.g. Scope 2.39:1, Flat 1.85:1, or Square 1.43:1) with slight overscan so side pillarboxes & edge chrome disappear cleanly.
 */
export function computeYoutubeCoverLayout(
  containerW: number,
  containerH: number,
  videoAspect = 16 / 9,
  overscan = 1.04,
): YoutubeCoverLayout {
  const safeW = Math.max(1, containerW);
  const safeH = Math.max(1, containerH);
  const containerAspect = safeW / safeH;
  const scale = Math.max(1, overscan);
  let width: number;
  let height: number;
  if (containerAspect >= videoAspect) {
    width = Math.round(safeW * scale);
    height = Math.round(width / videoAspect);
  } else {
    height = Math.round(safeH * scale);
    width = Math.round(height * videoAspect);
  }
  return {
    width,
    height,
    left: Math.round((safeW - width) / 2),
    top: Math.round((safeH - height) / 2),
  };
}

export const youtubeWatchUrl = (videoId: string) => `https://www.youtube.com/watch?v=${videoId}`;
