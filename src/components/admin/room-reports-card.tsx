import { Flag } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listRoomReports } from "@/services/room-report.service";

/** Entry to the room-report list in admin Settings: shows how many are still open. */
export async function RoomReportsCard() {
  const [t, reports] = await Promise.all([getTranslations("admin.roomReports"), listRoomReports()]);
  const open = reports.filter((r) => r.status === "open").length;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="type-item-title">{t("title")}</CardTitle>
        <CardDescription>{open > 0 ? t("openCount", { count: open }) : t("noneOpen")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline" size="pill">
          <Link href="/admin/settings/room-reports">
            <Flag aria-hidden />
            {t("open")}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
