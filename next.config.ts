import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Lets a phone on the same Wi-Fi use the dev server (http://<LAN IP>:3000). Without this Next blocks the dev scripts
  // for any other origin than localhost, the page never hydrates and every link becomes a full page load.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
  reactCompiler: true,
  // Lets a second server (e.g. for browser tests on another port) use its own build folder next to the developer's dev server.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default withNextIntl(nextConfig);
