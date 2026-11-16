import { Settings } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { SignOutButton } from "@/components/sign-out-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { UserRole } from "@/lib/user-constants";

interface ProfileOverviewProps {
  name: string;
  /** Email and/or username, shown under the name. */
  identity: string;
  role: UserRole;
  backHref: string;
  settingsHref: string;
}

/**
 * Body of the Profile page, opened from the avatar (user and admin share it). Placeholder for now:
 * the real profile comes in a later sprint. Settings and Sign out live here because the avatar opens this page directly.
 */
export async function ProfileOverview({ name, identity, role, backHref, settingsHref }: ProfileOverviewProps) {
  const t = await getTranslations("profile");
  const account = await getTranslations("account");

  return (
    <div className="flex w-full flex-col gap-4 p-4">
      <PageHeader title={t("title")} backHref={backHref} />
      <Card>
        <CardHeader>
          <CardTitle>{name}</CardTitle>
          <CardDescription>{identity}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
          <p>{t("role", { role })}</p>
          <p>{t("comingSoon")}</p>
        </CardContent>
      </Card>
      <nav aria-label={account("menuLabel")} className="flex flex-col gap-2">
        <Button asChild variant="ghost" className="h-target justify-start gap-2">
          <Link href={settingsHref}>
            <Settings aria-hidden />
            {account("settings")}
          </Link>
        </Button>
        <SignOutButton />
      </nav>
    </div>
  );
}
