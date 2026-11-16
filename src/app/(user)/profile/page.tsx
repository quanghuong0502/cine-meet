import { Settings } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { SignOutButton } from "@/components/sign-out-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser } from "@/lib/auth/guards";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("profile");
  return { title: t("title") };
}

/** Opened from the avatar in the header. Placeholder for now; the real profile comes in a later sprint. */
export default async function ProfilePage() {
  const user = await requireUser();
  const t = await getTranslations("profile");
  const account = await getTranslations("account");

  return (
    <div className="flex w-full flex-col gap-4 p-4">
      <PageHeader title={t("title")} backHref="/" />
      <Card>
        <CardHeader>
          <CardTitle>{user.name}</CardTitle>
          <CardDescription>
            {[user.email, user.username].filter(Boolean).join(" · ")}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
          <p>{t("role", { role: user.role })}</p>
          <p>{t("comingSoon")}</p>
        </CardContent>
      </Card>
      {/* Account things stay one tap away now that the avatar opens this page. */}
      <nav aria-label={account("menuLabel")} className="flex flex-col gap-2">
        <Button asChild variant="ghost" className="h-target justify-start gap-2">
          <Link href="/settings">
            <Settings aria-hidden />
            {account("settings")}
          </Link>
        </Button>
        <SignOutButton />
      </nav>
    </div>
  );
}
