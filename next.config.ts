import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Lets a phone on the same Wi-Fi use the dev server (http://<LAN IP>:3000). Without this Next blocks the dev scripts
  // for any other origin than localhost, the page never hydrates and every link becomes a full page load.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
  reactCompiler: true,
  // Client Router Cache: a page seen in the last 30 s opens at once when you come back to it (tabs, menu), with no loader.
  // Any server action that calls revalidatePath/updateTag clears this cache, so an edit made here always shows up straight away.
  experimental: { staleTimes: { dynamic: 30, static: 180 } },
  // Lets a second server (e.g. for browser tests on another port) use its own build folder next to the developer's dev server.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default withNextIntl(nextConfig);
