import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ResourceForm } from "@/components/admin/resource-form";
import { PageHeader } from "@/components/page-header";
import { resolveBackHref } from "@/lib/admin/back-href";
import { generateTempPassword } from "@/lib/temp-password";
import { getManagedUser } from "@/services/admin-user.service";
import { resetPasswordAction } from "../../actions";
import { resetPasswordFields } from "../../fields";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.users");
  return { title: t("resetTitle") };
}

export default async function ResetPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string }>;
}) {
  const [{ id }, { back }, t] = await Promise.all([params, searchParams, getTranslations("admin.users")]);
  const user = await getManagedUser(id);
  if (!user || !user.authProviders.includes("credentials")) notFound();
  const backHref = resolveBackHref(back, `/admin/users/${id}`);

  return (
    <div className="mx-auto flex w-full max-w-page flex-1 flex-col gap-section p-inset">
      <PageHeader title={t("resetTitle")} backHref={backHref} />
      <ResourceForm
        itemId={id}
        fields={await resetPasswordFields()}
        values={{ temporaryPassword: generateTempPassword() }}
        backHref={backHref}
        saveAction={resetPasswordAction}
      />
    </div>
  );
}
