import { FlagIcon } from "@solar-icons/react/line-duotone";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IconBadge } from "@/components/ui/icon-badge";
import { countOpenRoomReports } from "@/services/room-report.service";

/** Entry to the room-report list in admin Settings: shows how many are still open. */
export async function RoomReportsCard() {
  const [t, open] = await Promise.all([getTranslations("admin.roomReports"), countOpenRoomReports()]);
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-item">
          <IconBadge tone={open > 0 ? "warning" : "success"}>
            <FlagIcon />
          </IconBadge>
          <CardTitle className="type-item-title">{t("title")}</CardTitle>
        </div>
        <CardDescription>{open > 0 ? t("openCount", { count: open }) : t("noneOpen")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline" size="pill">
          <Link href="/admin/settings/room-reports">
            <FlagIcon aria-hidden />
            {t("open")}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
