import type { Metadata } from "next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Mascot } from "@/components/mascot";
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
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-4">
      <div className="flex items-end justify-center">
        <Mascot name="bubu" size={96} decorative priority />
        <Mascot name="dudu" size={96} decorative priority flip className="-ml-3" />
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Đăng nhập</CardTitle>
          <CardDescription>
            Lập kế hoạch xem phim cùng bạn bè.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm
            callbackUrl={getSafeRedirectPath(callbackUrl)}
            initialError={initialError}
          />
        </CardContent>
      </Card>
    </main>
  );
}
