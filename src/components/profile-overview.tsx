import { Pencil, Settings } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { UserAvatar } from "@/components/user-avatar";
import { SignOutButton } from "@/components/sign-out-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatVietnamPhone } from "@/lib/phone";
import type { SeatPreference, UserRole } from "@/lib/user-constants";

interface ProfileOverviewProps {
  name: string;
  /** Email and/or username, shown under the name. */
  identity: string;
  role: UserRole;
  avatar?: string;
  /** Stored form, 84xxxxxxxxx. */
  phone?: string;
  seatPreference?: SeatPreference;
  backHref: string;
  settingsHref: string;
  editHref: string;
}

/**
 * Body of the Profile page, opened from the avatar (user and admin share it): picture, name, phone and seat preference,
 * with Edit. Settings and Sign out live here because the avatar opens this page directly.
 */
export async function ProfileOverview({ name, identity, role, avatar, phone, seatPreference, backHref, settingsHref, editHref }: ProfileOverviewProps) {
  const t = await getTranslations("profile");
  const account = await getTranslations("account");

  return (
    <div className="flex w-full flex-col gap-4 p-4">
      <PageHeader title={t("title")} backHref={backHref} />
      <Card>
        <CardHeader className="flex-row items-center gap-4">
          <UserAvatar name={name} image={avatar} size={64} />
          <div className="flex min-w-0 flex-col gap-1">
            <CardTitle className="type-heading break-words">{name}</CardTitle>
            <CardDescription className="break-words">{identity}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 type-secondary">
          <dl className="grid gap-2">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{t("fields.phone.label")}</dt>
              <dd className="font-medium">{phone ? formatVietnamPhone(phone) : t("notSet")}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{t("fields.seatPreference.label")}</dt>
              <dd className="font-medium">{seatPreference ? t(`seat.${seatPreference}`) : t("notSet")}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{t("roleLabel")}</dt>
              <dd className="font-medium">{t(`roles.${role}`)}</dd>
            </div>
          </dl>
          <Button asChild variant="outline" size="cta-sm">
            <Link href={editHref}>
              <Pencil aria-hidden />
              {t("edit")}
            </Link>
          </Button>
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
