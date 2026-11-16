import type { NextAuthConfig } from "next-auth";
import { USER_ROLES, type UserRole } from "@/lib/user-constants";

/**
 * Edge-safe Auth.js config: must NOT import Mongoose, bcrypt or anything that touches the DB.
 * Providers and DB-backed callbacks live in `auth.ts`.
 */

const LOGIN_PATH = "/login";
const ADMIN_PAGE_PREFIX = "/admin";
const ADMIN_API_PREFIX = "/api/admin";
const AUTH_API_PREFIX = "/api/auth";

function isUserRole(value: unknown): value is UserRole {
  return USER_ROLES.some((role) => role === value);
}

function startsWithSegment(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export const authConfig = {
  pages: { signIn: LOGIN_PATH },
  // Credentials provider does not work with database sessions, so JWT is required.
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const { pathname } = nextUrl;
      const isLoggedIn = Boolean(auth?.user);
      const isAdmin = auth?.user?.role === "admin";
      const isAdminApi = startsWithSegment(pathname, ADMIN_API_PREFIX);

      if (startsWithSegment(pathname, AUTH_API_PREFIX)) return true;

      if (pathname === LOGIN_PATH) {
        return isLoggedIn ? Response.redirect(new URL("/", nextUrl)) : true;
      }

      if (isAdminApi) {
        if (!isLoggedIn) return Response.json({ error: "unauthenticated" }, { status: 401 });
        if (!isAdmin) return Response.json({ error: "forbidden" }, { status: 403 });
        return true;
      }

      if (!isLoggedIn) {
        // Relative callbackUrl (Auth.js would add an absolute one) so the login page can validate it strictly.
        const loginUrl = new URL(LOGIN_PATH, nextUrl);
        loginUrl.searchParams.set("callbackUrl", `${pathname}${nextUrl.search}`);
        return Response.redirect(loginUrl);
      }

      if (startsWithSegment(pathname, ADMIN_PAGE_PREFIX) && !isAdmin) {
        return Response.redirect(new URL("/", nextUrl));
      }
      return true;
    },
    session({ session, token }) {
      if (token.userId) session.user.id = token.userId;
      if (isUserRole(token.role)) session.user.role = token.role;
      return session;
    },
  },
} satisfies NextAuthConfig;
