import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ProfileOverview } from "@/components/profile-overview";
import { requireUser } from "@/lib/auth/guards";
import { getProfile } from "@/services/profile.service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("profile");
  return { title: t("title") };
}

export default async function ProfilePage() {
  const user = await requireUser();
  const profile = await getProfile(user.userId);
  return (
    <ProfileOverview
      name={user.name}
      identity={[user.email, user.username].filter(Boolean).join(" · ")}
      role={user.role}
      avatar={profile?.avatar}
      phone={profile?.phone}
      seatPreference={profile?.seatPreference}
      backHref="/"
      settingsHref="/settings"
      editHref="/profile/edit"
    />
  );
}
