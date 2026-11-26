import { ChatRoundLikeIcon } from "@solar-icons/react/line-duotone";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IconBadge } from "@/components/ui/icon-badge";

/** Entry to the pronouns screen in the admin Settings page. */
export async function PronounsSettingsCard() {
  const t = await getTranslations("admin.pronouns");
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-item">
          <IconBadge tone="primary">
            <ChatRoundLikeIcon />
          </IconBadge>
          <CardTitle className="type-item-title">{t("title")}</CardTitle>
        </div>
        <CardDescription>{t("cardDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline" size="pill">
          <Link href="/admin/settings/pronouns">
            <ChatRoundLikeIcon aria-hidden />
            {t("open")}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
