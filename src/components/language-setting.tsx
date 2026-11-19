import { getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/locale-switcher";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** The only place the interface language is configured. Used by the user and admin Settings pages. */
export async function LanguageSetting() {
  const t = await getTranslations("settings.language");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="type-item-title">{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <LocaleSwitcher />
      </CardContent>
    </Card>
  );
}
