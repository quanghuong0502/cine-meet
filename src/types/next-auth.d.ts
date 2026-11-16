import type { DefaultSession } from "next-auth";
import type { UserRole } from "@/lib/user-constants";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
    } & DefaultSession["user"];
  }

  interface User {
    role?: UserRole;
  }
}

// `next-auth/jwt` only re-exports this module, so the augmentation must target the original.
declare module "@auth/core/jwt" {
  interface JWT {
    userId?: string;
    role?: UserRole;
  }
}
