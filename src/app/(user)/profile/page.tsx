import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser } from "@/lib/auth/guards";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("profile");
  return { title: t("title") };
}

export default async function ProfilePage() {
  const user = await requireUser();
  const t = await getTranslations("profile");

  return (
    <div className="flex flex-col gap-4 p-4">
      <PageHeader title={t("title")} backHref="/" />
      <Card>
        <CardHeader>
          <CardTitle>{user.name}</CardTitle>
          <CardDescription>
            {[user.email, user.username].filter(Boolean).join(" · ")}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
          <p>{t("role", { role: user.role })}</p>
          <p>{t("comingSoon")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
