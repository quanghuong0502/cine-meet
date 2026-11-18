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
    // The screen is exactly one viewport tall and never scrolls: the illustration absorbs the spare
    // space (and shrinks on short phones). If the viewport is shorter than the form itself the page can
    // still scroll, but the scrollbar stays hidden.
    <main className="mx-auto flex h-dvh w-full max-w-form flex-col gap-group overflow-y-auto [@media(max-height:600px)]:gap-stack px-inset-lg pt-(--inset-top) pb-(--inset-bottom) [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <header className="flex min-h-0 flex-1 flex-col items-center justify-center gap-stack">
        <div className="flex min-h-0 w-full flex-1 items-center justify-center">
          <Mascot
            pose="duo-watching"
            size={200}
            decorative
            priority
            fillHeight
            className="max-h-mascot-max"
          />
        </div>
        <Wordmark className="type-display" />
      </header>

      <div className="flex flex-col gap-tight">
        <h1 className="type-title">{t("title")}</h1>
        <p className="type-secondary text-muted-foreground [@media(max-height:640px)]:hidden">
          {t("subtitle")}
        </p>
      </div>

      <LoginForm
        callbackUrl={getSafeRedirectPath(callbackUrl)}
        initialError={initialError}
      />
    </main>
  );
}
