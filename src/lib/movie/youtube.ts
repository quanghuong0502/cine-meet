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

export const youtubeThumbnailUrl = (videoId: string) => `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
/**
 * The player address. With `controls: false` YouTube draws no bar of its own (we draw ours, driven by the IFrame API, which needs
 * `enablejsapi` and our `origin`); without it the player keeps its own bar, as the way out when the API cannot load.
 */
export const youtubeEmbedUrl = (videoId: string, options: { controls: boolean; origin?: string } = { controls: true }) =>
  `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1&iv_load_policy=3` +
  (options.controls ? "" : `&controls=0&fs=0&disablekb=1&enablejsapi=1${options.origin ? `&origin=${encodeURIComponent(options.origin)}` : ""}`);
export const youtubeWatchUrl = (videoId: string) => `https://www.youtube.com/watch?v=${videoId}`;
