import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ResourceManager } from "@/components/admin/resource-manager";
import { PageHeader } from "@/components/page-header";
import { listUsers } from "@/services/admin-user.service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.users");
  return { title: t("title") };
}

/** "Lan Anh Nguyen" -> "AN": the first letters of the last two words. */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const t = await getTranslations("admin.users");
  const { q = "" } = await searchParams;
  const users = await listUsers({ q });

  return (
    <div className="mx-auto flex w-full max-w-page flex-1 flex-col gap-section p-inset">
      <PageHeader title={t("title")} description={t("description")} />
      <ResourceManager
        basePath="/admin/users"
        query={q}
        searchLabels={{ placeholder: t("searchPlaceholder"), label: t("searchLabel") }}
        labels={{ addButton: t("addButton"), emptyTitle: t("emptyTitle"), emptyDescription: t("emptyDescription") }}
        items={users.map((user) => ({
          id: user.id,
          title: user.name,
          subtitle: user.username ?? user.email,
          avatarText: initials(user.name),
          meta: [
            t(`roles.${user.role}`),
            ...(user.status === "locked" ? [t("badges.locked")] : []),
            ...(user.mustChangePassword ? [t("badges.mustChange")] : []),
          ],
        }))}
      />
    </div>
  );
}
