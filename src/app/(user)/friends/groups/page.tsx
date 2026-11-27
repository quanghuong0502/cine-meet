import type { Metadata } from "next";
import { AddIcon, AltArrowRightIcon, UsersGroupRoundedIcon } from "@solar-icons/react/line-duotone";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { IconBadge } from "@/components/ui/icon-badge";
import { requireUser } from "@/lib/auth/guards";
import { listGroups } from "@/services/friend.service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("friends.groups");
  return { title: t("title") };
}

export default async function GroupsPage() {
  const user = await requireUser();
  const t = await getTranslations("friends.groups");
  const groups = await listGroups(user.userId);
  return (
    <div className="flex w-full flex-1 flex-col gap-section p-inset">
      <PageHeader title={t("title")} backHref="/friends" />
      {groups.length === 0 ? (
        <EmptyState mascot="dudu-happy" title={t("emptyTitle")} description={t("emptyDescription")} />
      ) : (
        <ul className="flex flex-col gap-stack">
          {groups.map((group) => (
            <li key={group.id}>
              <Link
                href={`/friends/groups/${group.id}`}
                className="flex min-h-row items-center gap-item rounded-xl border bg-card p-inset-sm transition-colors outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-muted/80"
              >
                <IconBadge tone="primary" size="md">
                  <UsersGroupRoundedIcon />
                </IconBadge>
                <span className="flex min-w-0 flex-1 flex-col gap-tight">
                  <span className="break-words type-item-title">{group.name}</span>
                  <span className="truncate type-secondary text-muted-foreground">
                    {group.members.length > 0
                      ? `${t("memberCount", { count: group.members.length })} · ${group.members.map((m) => m.name).join(", ")}`
                      : t("memberCount", { count: 0 })}
                  </span>
                </span>
                <AltArrowRightIcon className="size-icon-sm shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Button asChild size="cta">
        <Link href="/friends/groups/new">
          <AddIcon aria-hidden />
          {t("add")}
        </Link>
      </Button>
    </div>
  );
}
