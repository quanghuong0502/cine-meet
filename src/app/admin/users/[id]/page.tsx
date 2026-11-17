import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ResourceForm } from "@/components/admin/resource-form";
import { PageHeader } from "@/components/page-header";
import { resolveBackHref } from "@/lib/admin/back-href";
import { requireAdmin } from "@/lib/auth/guards";
import { getManagedUser } from "@/services/admin-user.service";
import { updateUserAction } from "../actions";
import { userFields } from "../fields";
import { UserActions } from "./user-actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.users");
  return { title: t("editTitle") };
}

export default async function EditUserPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string }>;
}) {
  const [{ id }, { back }, admin, t, format] = await Promise.all([
    params,
    searchParams,
    requireAdmin(),
    getTranslations("admin.users"),
    getFormatter(),
  ]);
  const user = await getManagedUser(id);
  if (!user) notFound();
  const backHref = resolveBackHref(back, "/admin/users");

  const info: [string, string | undefined][] = [
    [t("info.username"), user.username],
    [t("info.email"), user.email],
    [t("info.phone"), user.phone],
    [t("info.signIn"), user.authProviders.map((provider) => t(`providers.${provider}`)).join(", ") || undefined],
    [t("info.status"), t(`statuses.${user.status}`)],
    [t("info.created"), format.dateTime(user.createdAt, { dateStyle: "medium", timeZone: "Asia/Ho_Chi_Minh" })],
  ];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4">
      <PageHeader title={user.name} backHref={backHref} />

      <dl className="grid gap-3 rounded-xl border bg-card p-4 text-sm">
        {info
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="min-w-0 break-words text-right font-medium">{value}</dd>
            </div>
          ))}
      </dl>

      <UserActions
        id={user.id}
        locked={user.status === "locked"}
        name={user.name}
        isSelf={user.id === admin.userId}
        canResetPassword={user.authProviders.includes("credentials")}
        resetHref={`/admin/users/${user.id}/reset-password?back=${encodeURIComponent(`/admin/users/${user.id}?back=${encodeURIComponent(backHref)}`)}`}
      />

      <ResourceForm
        itemId={user.id}
        fields={await userFields("edit")}
        values={{ name: user.name, role: user.role }}
        backHref={backHref}
        saveAction={updateUserAction}
      />
    </div>
  );
}
