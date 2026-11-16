import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Mascot } from "@/components/mascot";
import { Wordmark } from "@/components/wordmark";
import { getSafeRedirectPath } from "@/lib/redirect";
import { LoginForm } from "./login-form";
import { loginErrorKey } from "./login-errors";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.login");
  return { title: t("title") };
}

interface LoginPageProps {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const t = await getTranslations("auth.login");
  const { callbackUrl, error } = await searchParams;
  const initialError = error ? t(`errors.${loginErrorKey(error)}`) : undefined;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-6 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
      <header className="flex flex-col items-center gap-2">
        <Mascot pose="duo-watching" size={200} decorative priority />
        <Wordmark className="text-3xl" />
      </header>

      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <LoginForm
        callbackUrl={getSafeRedirectPath(callbackUrl)}
        initialError={initialError}
      />
    </main>
  );
}
