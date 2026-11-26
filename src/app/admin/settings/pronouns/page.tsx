import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PronounPicker } from "@/components/admin/pronoun-picker";
import { ResourceForm } from "@/components/admin/resource-form";
import { PageHeader } from "@/components/page-header";
import { ADMIN_SHELL_NAMESPACES, ScopedIntlProvider } from "@/components/scoped-intl-provider";
import { requireAdmin } from "@/lib/auth/guards";
import { getPronouns } from "@/services/pronouns.service";
import { savePronounsAction } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.pronouns");
  return { title: t("title") };
}

export default async function PronounsSettingsPage() {
  await requireAdmin();
  // Read straight from the database (not the cache) so the form always starts from what is really saved.
  const [t, pronouns] = await Promise.all([getTranslations("admin.pronouns"), getPronouns()]);

  return (
    <ScopedIntlProvider namespaces={[...ADMIN_SHELL_NAMESPACES, "admin.pronouns"]}>
      <div className="mx-auto flex w-full max-w-page flex-1 flex-col gap-section p-inset">
        <PageHeader title={t("title")} backHref="/admin/settings" />
        <ResourceForm itemId={null} fields={[]} values={{}} backHref="/admin/settings" saveAction={savePronounsAction} lead={<PronounPicker initial={pronouns} />} />
      </div>
    </ScopedIntlProvider>
  );
}
