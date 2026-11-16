import type { Metadata } from "next";
import { Mascot } from "@/components/mascot";
import { Wordmark } from "@/components/wordmark";
import { getSafeRedirectPath } from "@/lib/redirect";
import { LoginForm } from "./login-form";
import { LOGIN_ERROR_MESSAGES, LOGIN_FALLBACK_ERROR } from "./messages";

export const metadata: Metadata = { title: "Đăng nhập" };

interface LoginPageProps {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { callbackUrl, error } = await searchParams;
  const initialError = error
    ? (LOGIN_ERROR_MESSAGES[error] ?? LOGIN_FALLBACK_ERROR)
    : undefined;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-6 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
      <header className="flex flex-col items-center gap-2">
        <div className="flex items-end justify-center">
          <Mascot pose="bubu-sleepy" size={96} decorative priority />
          <Mascot pose="dudu-happy" size={96} decorative priority flip className="-ml-3" />
        </div>
        <Wordmark className="text-xl" />
      </header>

      <div className="flex flex-col gap-1.5">
        <h1 className="text-3xl font-semibold tracking-tight">Đăng nhập</h1>
        <p className="text-sm text-muted-foreground">
          Đăng nhập để lập kế hoạch xem phim cùng bạn bè.
        </p>
      </div>

      <LoginForm
        callbackUrl={getSafeRedirectPath(callbackUrl)}
        initialError={initialError}
      />
    </main>
  );
}
