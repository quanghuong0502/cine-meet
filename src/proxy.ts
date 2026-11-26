import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Uses only the edge-safe config: the `authorized` callback decides who may pass
// (login required everywhere, `/admin/*` and `/api/admin/*` admin-only).
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  // Skip Next internals and static/PWA assets so they never get redirected to /login.
  // push/onesignal: OneSignal's service worker file, which the browser fetches without a session.
  // api/cron: called by the host's scheduler, which has no session; the route checks CRON_SECRET itself.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline(?:/|$)|offline\\.html|push/onesignal|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
