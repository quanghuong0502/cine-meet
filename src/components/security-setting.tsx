import { KeyIcon } from "@solar-icons/react/line-duotone";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { IconBadge } from "@/components/ui/icon-badge";

/** Password change entry in Settings. Accounts that only sign in with Google have no password, so nothing is shown. */
export async function SecuritySetting({ hasPassword }: { hasPassword: boolean }) {
  if (!hasPassword) return null;
  const t = await getTranslations("settings.security");
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-item">
          <IconBadge tone="success">
            <KeyIcon />
          </IconBadge>
          <CardTitle className="type-item-title">{t("title")}</CardTitle>
        </div>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline" size="pill">
          <Link href="/change-password">
            <KeyIcon aria-hidden />
            {t("changePassword")}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
