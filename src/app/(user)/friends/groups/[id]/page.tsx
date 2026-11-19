import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { GroupForm } from "@/components/friends/group-form";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/guards";
import { getFriendOverview, listGroups } from "@/services/friend.service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("friends.groups");
  return { title: t("editTitle") };
}

export default async function EditGroupPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const t = await getTranslations("friends.groups");
  const [groups, { friends }] = await Promise.all([listGroups(user.userId), getFriendOverview(user.userId)]);
  const group = groups.find((g) => g.id === id);
  if (!group) notFound();
  return (
    <div className="flex w-full flex-col gap-section p-inset">
      <PageHeader title={t("editTitle")} backHref="/friends/groups" />
      <GroupForm groupId={group.id} initialName={group.name} initialMemberIds={group.members.map((m) => m.id)} friends={friends} />
    </div>
  );
}
