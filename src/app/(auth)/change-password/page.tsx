import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BackButton } from "@/components/back-button";
import { Mascot } from "@/components/mascot";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser } from "@/lib/auth/guards";
import { ChangePasswordForm } from "./change-password-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.changePassword");
  return { title: t("title") };
}

export default async function ChangePasswordPage() {
  const user = await requireUser({ allowPasswordChange: true });
  const t = await getTranslations("auth.changePassword");

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center gap-8 p-4">
      {/* Installed PWAs have no browser Back button. Not shown when the change is required: there is nowhere to go until it is done. */}
      {user.mustChangePassword ? null : (
        // Pinned to the top left like on every other screen; inside the centred column it would float mid-screen.
        <div className="absolute inset-x-0 top-0 mx-auto w-full max-w-sm px-4 pt-2">
          <BackButton href={user.role === "admin" ? "/admin/settings" : "/settings"} />
        </div>
      )}
      <Mascot pose="duo-watching" size={144} decorative priority />
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">{t("title")}</CardTitle>
          <CardDescription>
            {user.mustChangePassword ? t("descriptionRequired") : t("description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </main>
  );
}
