import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ResourceForm } from "@/components/admin/resource-form";
import { PageHeader } from "@/components/page-header";
import { resolveBackHref } from "@/lib/admin/back-href";
import { generateTempPassword } from "@/lib/temp-password";
import { createUserAction } from "../actions";
import { userFields } from "../fields";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.users");
  return { title: t("createTitle") };
}

export default async function NewUserPage({ searchParams }: { searchParams: Promise<{ back?: string }> }) {
  const t = await getTranslations("admin.users");
  const { back } = await searchParams;
  const backHref = resolveBackHref(back, "/admin/users");

  return (
    <div className="mx-auto flex w-full max-w-page flex-1 flex-col gap-section p-inset">
      <PageHeader title={t("createTitle")} backHref={backHref} hideTitle />
      <ResourceForm
        itemId={null}
        fields={await userFields("create")}
        values={{ role: "user", temporaryPassword: generateTempPassword() }}
        backHref={backHref}
        saveAction={createUserAction}
      />
    </div>
  );
}
