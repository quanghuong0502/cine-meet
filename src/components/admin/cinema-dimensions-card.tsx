import { RulerIcon } from "@solar-icons/react/line-duotone";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IconBadge } from "@/components/ui/icon-badge";

/** Entry to system-wide cinema dimension defaults (row pitch, step height, screen ratios) in Admin Settings. */
export async function CinemaDimensionsCard() {
  const t = await getTranslations("admin.cinemaDimensions");
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-item">
          <IconBadge tone="warning">
            <RulerIcon />
          </IconBadge>
          <CardTitle className="type-item-title">{t("title")}</CardTitle>
        </div>
        <CardDescription>{t("cardDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline" size="pill">
          <Link href="/admin/settings/cinema-dimensions">
            <RulerIcon aria-hidden />
            {t("open")}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
