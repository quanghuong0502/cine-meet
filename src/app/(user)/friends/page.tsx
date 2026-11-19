import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { FriendsScreen } from "@/components/friends/friends-screen";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/guards";
import { getFriendOverview, getInviteCode } from "@/services/friend.service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("friends");
  return { title: t("title") };
}

export default async function FriendsPage() {
  const user = await requireUser();
  const t = await getTranslations("friends");
  const [overview, inviteCode] = await Promise.all([getFriendOverview(user.userId), getInviteCode(user.userId)]);
  return (
    <div className="flex w-full flex-col gap-section p-inset">
      <PageHeader title={t("title")} backHref="/profile" />
      <FriendsScreen overview={overview} inviteCode={inviteCode} />
    </div>
  );
}
