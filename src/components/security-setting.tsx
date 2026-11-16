import { KeyRound } from "lucide-react";
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

/** Password change entry in Settings. Accounts that only sign in with Google have no password, so nothing is shown. */
export async function SecuritySetting({ hasPassword }: { hasPassword: boolean }) {
  if (!hasPassword) return null;
  const t = await getTranslations("settings.security");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline" className="h-control rounded-full px-6 text-base">
          <Link href="/change-password">
            <KeyRound aria-hidden />
            {t("changePassword")}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
