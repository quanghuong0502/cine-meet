import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ProfileOverview } from "@/components/profile-overview";
import { requireAdmin } from "@/lib/auth/guards";
import { getProfile } from "@/services/profile.service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("profile");
  return { title: t("title") };
}

export default async function AdminProfilePage() {
  const admin = await requireAdmin();
  const profile = await getProfile(admin.userId);
  return (
    <ProfileOverview
      name={admin.name}
      identity={[admin.email, admin.username].filter(Boolean).join(" · ")}
      role={admin.role}
      avatar={profile?.avatar}
      phone={profile?.phone}
      seatPreference={profile?.seatPreference}
      backHref="/admin"
      settingsHref="/admin/settings"
      editHref="/admin/profile/edit"
    />
  );
}
