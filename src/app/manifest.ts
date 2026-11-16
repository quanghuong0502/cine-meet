import type { MetadataRoute } from "next";
import { APP_NAME } from "@/components/wordmark";

// Minimal PWA manifest. The colours mirror the dark theme background.
// TODO: add 192/512 PNG icons once real branding exists (SVG-only icons limit installability).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: "Lập kế hoạch và quản lý xem phim cùng bạn bè.",
    lang: "vi",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#13080d",
    theme_color: "#13080d",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
