import { AltArrowRightIcon, Pen2Icon, SettingsIcon, UsersGroupRoundedIcon } from "@solar-icons/react/line-duotone";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { UserAvatar } from "@/components/user-avatar";
import { SignOutButton } from "@/components/sign-out-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IconBadge } from "@/components/ui/icon-badge";
import { formatVietnamPhone } from "@/lib/phone";
import type { SeatPreference, UserRole } from "@/lib/user-constants";
import { PX } from "@/lib/ui-sizes";

interface ProfileOverviewProps {
  name: string;
  /** Email and/or username, shown under the name. */
  identity: string;
  role: UserRole;
  avatar?: string;
  /** Stored form, 84xxxxxxxxx. */
  phone?: string;
  seatPreference?: SeatPreference;
  /** Omitted for the user app (Profile is a tab there, with no back arrow); admin goes back to the admin home. */
  backHref?: string;
  settingsHref: string;
  editHref: string;
  /** The Friends screen; only the user app has one (admin has no friends). */
  friendsHref?: string;
}

/**
 * Body of the Profile page, opened from the avatar (user and admin share it): picture, name, phone and seat preference,
 * with Edit. Settings and Sign out live here because the avatar opens this page directly.
 */
export async function ProfileOverview({ name, identity, role, avatar, phone, seatPreference, backHref, settingsHref, editHref, friendsHref }: ProfileOverviewProps) {
  const t = await getTranslations("profile");
  const account = await getTranslations("account");

  return (
    <div className="flex w-full flex-col gap-group p-inset">
      <PageHeader title={t("title")} backHref={backHref} />
      <Card>
        <CardHeader className="flex flex-row items-center gap-group">
          <UserAvatar name={name} image={avatar} size={PX.avatarLg} />
          <div className="flex min-w-0 flex-1 flex-col gap-tight">
            <CardTitle className="type-heading break-words">{name}</CardTitle>
            <CardDescription className="break-words">{identity}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-item type-secondary">
          <dl className="grid gap-stack">
            <div className="flex items-baseline justify-between gap-group">
              <dt className="shrink-0 text-muted-foreground">{t("fields.phone.label")}</dt>
              <dd className="min-w-0 break-words text-right font-medium tabular-nums">{phone ? formatVietnamPhone(phone) : t("notSet")}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-group">
              <dt className="shrink-0 text-muted-foreground">{t("fields.seatPreference.label")}</dt>
              <dd className="min-w-0 break-words text-right font-medium">{seatPreference ? t(`seat.${seatPreference}`) : t("notSet")}</dd>
            </div>
            {role !== "user" ? (
              <div className="flex items-baseline justify-between gap-group">
                <dt className="shrink-0 text-muted-foreground">{t("roleLabel")}</dt>
                <dd className="min-w-0 break-words text-right font-medium">{t(`roles.${role}`)}</dd>
              </div>
            ) : null}
          </dl>
          <Button asChild variant="outline" size="cta-sm">
            <Link href={editHref}>
              <Pen2Icon aria-hidden />
              {t("edit")}
            </Link>
          </Button>
        </CardContent>
      </Card>
      <nav aria-label={account("menuLabel")} className="flex flex-col gap-item">
        <div className="divide-y overflow-hidden rounded-xl border bg-card">
          {friendsHref ? (
            <Link
              href={friendsHref}
              className="flex min-h-row items-center gap-item px-inset-sm type-body font-medium transition-colors outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-muted/80"
            >
              <IconBadge tone="primary">
                <UsersGroupRoundedIcon />
              </IconBadge>
              <span className="min-w-0 flex-1">{t("friends")}</span>
              <AltArrowRightIcon className="size-icon-sm shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          ) : null}
          <Link
            href={settingsHref}
            className="flex min-h-row items-center gap-item px-inset-sm type-body font-medium transition-colors outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-muted/80"
          >
            <IconBadge tone="info">
              <SettingsIcon />
            </IconBadge>
            <span className="min-w-0 flex-1">{account("settings")}</span>
            <AltArrowRightIcon className="size-icon-sm shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </div>
        <div className="overflow-hidden rounded-xl border bg-card">
          <SignOutButton className="rounded-none px-inset-sm" />
        </div>
      </nav>
    </div>
  );
}
