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
import { PX } from "@/lib/ui-sizes";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.changePassword");
  return { title: t("title") };
}

export default async function ChangePasswordPage() {
  const user = await requireUser({ allowPasswordChange: true });
  const t = await getTranslations("auth.changePassword");

  return (
    <main className="flex min-h-dvh flex-col p-inset">
      {/* Installed PWAs have no browser Back button. Not shown when the change is required: there is nowhere to go until it is done. */}
      {user.mustChangePassword ? null : (
        <div className="mx-auto w-full max-w-form">
          <BackButton href={user.role === "admin" ? "/admin/settings" : "/settings"} />
        </div>
      )}
      <div className="mx-auto flex w-full max-w-form flex-1 flex-col items-center justify-center gap-section py-inset-sm">
        <Mascot pose="duo-watching" size={PX.mascot} decorative preload />
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="type-title">{t("title")}</CardTitle>
            <CardDescription>
              {user.mustChangePassword ? t("descriptionRequired") : t("description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
