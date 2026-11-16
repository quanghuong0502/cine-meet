/**
 * Shared user constants. Kept free of Mongoose so they can be imported from
 * edge-safe code such as `auth.config.ts` and `proxy.ts`.
 */

export const USER_ROLES = ["admin", "user"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ["active", "locked"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const AUTH_PROVIDERS = ["google", "credentials"] as const;
export type AuthProviderName = (typeof AUTH_PROVIDERS)[number];
