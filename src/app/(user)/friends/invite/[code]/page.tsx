import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { InviteAccept } from "@/components/friends/invite-accept";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { requireUser } from "@/lib/auth/guards";
import { PX } from "@/lib/ui-sizes";
import { findInviter, getRelationshipState } from "@/services/friend.service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("friends.invite");
  return { title: t("title") };
}

/** Opened from someone's friend link. Not signed in: the proxy sends the person to /login first and brings them back here. */
export default async function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const user = await requireUser();
  const { code } = await params;
  const t = await getTranslations("friends.invite");
  const inviter = await findInviter(code);
  const relation = inviter && inviter.id !== user.userId ? await getRelationshipState(user.userId, inviter.id) : "none";

  return (
    <div className="flex w-full flex-col gap-section p-inset">
      <PageHeader title={t("title")} backHref="/friends" />
      {!inviter ? (
        <EmptyState
          title={t("notFoundTitle")}
          description={t("notFoundDescription")}
          action={
            <Button asChild size="pill">
              <Link href="/friends">{t("toFriends")}</Link>
            </Button>
          }
        />
      ) : inviter.id === user.userId ? (
        <EmptyState
          mascot="dudu-happy"
          title={t("selfTitle")}
          description={t("selfDescription")}
          action={
            <Button asChild size="pill">
              <Link href="/friends">{t("toFriends")}</Link>
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col items-center gap-section px-inset-lg py-inset-xl text-center">
          <UserAvatar name={inviter.name} image={inviter.avatar} size={PX.avatarLg} />
          <p className="type-heading break-words">
            {relation === "friends"
              ? t("done.already_friends", { name: inviter.name })
              : relation === "outgoing"
                ? t("done.already_requested", { name: inviter.name })
                : relation === "incoming"
                  ? t("incomingPrompt", { name: inviter.name })
                  : t("prompt", { name: inviter.name })}
          </p>
          <div className="w-full max-w-form">
            {relation === "friends" || relation === "outgoing" ? (
              <Button asChild size="cta">
                <Link href="/friends">{t("toFriends")}</Link>
              </Button>
            ) : (
              <InviteAccept code={code} name={inviter.name} label={relation === "incoming" ? t("acceptButton") : undefined} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
