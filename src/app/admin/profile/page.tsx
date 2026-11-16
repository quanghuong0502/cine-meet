import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ProfileOverview } from "@/components/profile-overview";
import { requireAdmin } from "@/lib/auth/guards";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("profile");
  return { title: t("title") };
}

export default async function AdminProfilePage() {
  const admin = await requireAdmin();
  return (
    <ProfileOverview
      name={admin.name}
      identity={[admin.email, admin.username].filter(Boolean).join(" · ")}
      role={admin.role}
      backHref="/admin"
      settingsHref="/admin/settings"
    />
  );
}
