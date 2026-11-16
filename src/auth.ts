import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { z } from "zod";
import { authConfig } from "@/auth.config";
import {
  authenticateWithPassword,
  findActiveSessionUserByEmail,
  signInWithGoogleProfile,
} from "@/services/user.service";

const credentialsSchema = z.object({
  identifier: z.string().trim().min(1),
  password: z.string().min(1),
});

export const ACCOUNT_LOCKED_CODE = "account_locked";
export const TOO_MANY_ATTEMPTS_CODE = "too_many_attempts";

/** Thrown for a locked account; `code` is surfaced to the login action. */
export class AccountLockedError extends CredentialsSignin {
  code = ACCOUNT_LOCKED_CODE;
}

/** Thrown while the progressive lockout is active; the code carries the minutes left ("too_many_attempts:15"). */
export class TooManyAttemptsError extends CredentialsSignin {
  constructor(retryAfterMinutes: number) {
    super();
    this.code = `${TOO_MANY_ATTEMPTS_CODE}:${retryAfterMinutes}`;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    // Reads AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET from the environment.
    Google,
    Credentials({
      credentials: { identifier: {}, password: {} },
      async authorize(rawCredentials) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        const result = await authenticateWithPassword(
          parsed.data.identifier,
          parsed.data.password,
        );
        if (result.ok) return result.user;
        if (result.reason === "locked") throw new AccountLockedError();
        if (result.reason === "throttled") {
          throw new TooManyAttemptsError(result.retryAfterMinutes);
        }
        return null;
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return true;

      const result = await signInWithGoogleProfile({
        email: profile?.email,
        name: profile?.name,
        picture: profile?.picture,
        emailVerified: profile?.email_verified,
      });
      if (result.ok) return true;
      return `/login?error=${result.reason}`;
    },
    async jwt({ token, user, account }) {
      // `user` is only present at sign-in; later calls keep what is already in the token.
      if (!user) return token;

      if (account?.provider === "google") {
        // The Google `user` object carries Google's id, not ours, so load our own record.
        const sessionUser = user.email
          ? await findActiveSessionUserByEmail(user.email)
          : null;
        if (!sessionUser) throw new Error("Không tìm thấy tài khoản sau khi đăng nhập Google.");
        token.userId = sessionUser.id;
        token.role = sessionUser.role;
      } else {
        token.userId = user.id;
        token.role = user.role;
      }
      return token;
    },
  },
});
