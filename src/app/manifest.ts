import type { MetadataRoute } from "next";
import { APP_NAME } from "@/components/wordmark";

// PWA manifest (docs: .claude/rules/pwa.md). The colours mirror the dark theme background.
// Icons are Bubu and Dudu (duo-watching) on the brand pink; the maskable one keeps its art inside the 80% safe zone.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: APP_NAME,
    short_name: APP_NAME,
    // The manifest is static (one file for everyone), so it stays in the default language.
    description: "Lập kế hoạch và quản lý xem phim cùng bạn bè.",
    lang: "vi",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#13080d",
    theme_color: "#13080d",
    categories: ["entertainment", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
