import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Mascot } from "@/components/mascot";
import { Button } from "@/components/ui/button";
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
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-4">
      {/* Installed PWAs have no browser Back button. Not shown when the change is required: there is nowhere to go until it is done. */}
      {user.mustChangePassword ? null : (
        <div className="w-full max-w-sm">
          <Button asChild variant="ghost" className="-ml-3 h-target gap-2 rounded-full">
            <Link href={user.role === "admin" ? "/admin/settings" : "/settings"}>
              <ArrowLeft aria-hidden />
              {t("back")}
            </Link>
          </Button>
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
