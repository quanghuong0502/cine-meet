import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ProfileOverview } from "@/components/profile-overview";
import { requireUser } from "@/lib/auth/guards";
import { countIncomingFriendRequests } from "@/services/friend.service";
import { getProfile } from "@/services/profile.service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("profile");
  return { title: t("title") };
}

export default async function ProfilePage() {
  const user = await requireUser();
  const [profile, incomingFriends] = await Promise.all([
    getProfile(user.userId),
    countIncomingFriendRequests(user.userId).catch(() => 0),
  ]);
  return (
    <ProfileOverview
      name={user.name}
      identity={[user.email, user.username].filter(Boolean).join(" · ")}
      role={user.role}
      avatar={profile?.avatar}
      phone={profile?.phone}
      seatPreference={profile?.seatPreference}
      settingsHref="/settings"
      editHref="/profile/edit"
      friendsHref="/friends"
      incomingFriends={incomingFriends}
    />
  );
}
