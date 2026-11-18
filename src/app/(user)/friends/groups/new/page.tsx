import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { GroupForm } from "@/components/friends/group-form";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/guards";
import { getFriendOverview } from "@/services/friend.service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("friends.groups");
  return { title: t("newTitle") };
}

export default async function NewGroupPage() {
  const user = await requireUser();
  const t = await getTranslations("friends.groups");
  const { friends } = await getFriendOverview(user.userId);
  return (
    <div className="flex w-full flex-col gap-section p-inset">
      <PageHeader title={t("newTitle")} backHref="/friends/groups" hideTitle />
      <GroupForm initialName="" initialMemberIds={[]} friends={friends} />
    </div>
  );
}
