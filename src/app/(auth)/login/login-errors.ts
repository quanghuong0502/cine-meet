/** Maps the `error` query parameter set by the Auth.js sign-in callback to a message key under `auth.login.errors`. */
const ERROR_KEYS = {
  locked: "accountLocked",
  email_unverified: "emailUnverified",
  not_registered: "notRegistered",
  session_expired: "sessionExpired",
  AccessDenied: "accessDenied",
} as const;

export type LoginErrorKey = (typeof ERROR_KEYS)[keyof typeof ERROR_KEYS] | "fallback";

export function loginErrorKey(error: string): LoginErrorKey {
  return Object.hasOwn(ERROR_KEYS, error)
    ? ERROR_KEYS[error as keyof typeof ERROR_KEYS]
    : "fallback";
}
