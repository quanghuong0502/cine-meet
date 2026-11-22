import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Uses only the edge-safe config: the `authorized` callback decides who may pass
// (login required everywhere, `/admin/*` and `/api/admin/*` admin-only).
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  // Skip Next internals and static/PWA assets so they never get redirected to /login.
  // push/onesignal: OneSignal's service worker file, which the browser fetches without a session.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline|push/onesignal|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
