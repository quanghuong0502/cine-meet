import type { MetadataRoute } from "next";

// Minimal PWA manifest. The colours mirror the dark theme background.
// TODO: add 192/512 PNG icons once real branding exists (SVG-only icons limit installability).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Movie App",
    short_name: "Movie App",
    description: "Lập kế hoạch và quản lý xem phim cùng bạn bè.",
    lang: "vi",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
