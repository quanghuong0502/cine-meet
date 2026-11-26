import { TranslateIcon } from "@solar-icons/react/line-duotone";
import { getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/locale-switcher";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { IconBadge } from "@/components/ui/icon-badge";

/** The only place the interface language is configured. Used by the user and admin Settings pages. */
export async function LanguageSetting() {
  const t = await getTranslations("settings.language");
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-item">
          <IconBadge tone="info">
            <TranslateIcon />
          </IconBadge>
          <CardTitle className="type-item-title">{t("title")}</CardTitle>
        </div>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <LocaleSwitcher />
      </CardContent>
    </Card>
  );
}
