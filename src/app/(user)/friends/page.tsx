import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { FriendsScreen } from "@/components/friends/friends-screen";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/guards";
import { resolveUserBackHref } from "@/lib/user-back-href";
import { getFriendOverview, getInviteCode } from "@/services/friend.service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("friends");
  return { title: t("title") };
}

type SearchParams = Record<string, string | string[] | undefined>;

export default async function FriendsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [user, t, sp] = await Promise.all([requireUser(), getTranslations("friends"), searchParams]);
  const backHref = resolveUserBackHref(sp.back, "/profile");
  const [overview, inviteCode] = await Promise.all([
    getFriendOverview(user.userId),
    user.inviteCode ? Promise.resolve(user.inviteCode) : getInviteCode(user.userId),
  ]);
  return (
    <div className="flex w-full flex-1 flex-col gap-section p-inset">
      <PageHeader title={t("title")} backHref={backHref} />
      <FriendsScreen overview={overview} inviteCode={inviteCode} />
    </div>
  );
}
