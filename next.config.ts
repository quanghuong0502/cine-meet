import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Lets a phone on the same Wi-Fi use the dev server (http://<LAN IP>:3000). Without this Next blocks the dev scripts
  // for any other origin than localhost, the page never hydrates and every link becomes a full page load.
  // *.trycloudflare.com: a quick HTTPS tunnel (`npx cloudflared tunnel --url http://localhost:3000`) for trying push and the installed app on a phone.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "*.trycloudflare.com"],
  poweredByHeader: false,
  reactCompiler: true,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  // Client Router Cache: a page seen in the last 30 s opens at once when you come back to it (tabs, menu), with no loader.
  // Any server action that calls revalidatePath/updateTag clears this cache, so an edit made here always shows up straight away.
  experimental: {
    staleTimes: { dynamic: 30, static: 180 },
    optimizePackageImports: [
      "radix-ui",
      "@solar-icons/react",
      "@solar-icons/react/line-duotone",
      "@solar-icons/react/linear",
      "@solar-icons/react/bold",
    ],
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
      },
      {
        source: "/push/onesignal/:path*",
        headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
      },
      {
        source: "/icons/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/splash/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
  // Lets a second server (e.g. for browser tests on another port) use its own build folder next to the developer's dev server.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default withNextIntl(nextConfig);
