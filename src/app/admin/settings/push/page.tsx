import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PushTestForm } from "@/components/admin/push-test-form";
import { PageHeader } from "@/components/page-header";
import { ADMIN_SHELL_NAMESPACES, ScopedIntlProvider } from "@/components/scoped-intl-provider";
import { requireAdmin } from "@/lib/auth/guards";
import { pushConfig } from "@/notifications/push";
import { listPushTargets } from "@/services/push.service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.pushTest");
  return { title: t("title") };
}

export default async function PushTestPage() {
  await requireAdmin();
  const [t, targets] = await Promise.all([getTranslations("admin.pushTest"), listPushTargets()]);
  return (
    <ScopedIntlProvider namespaces={[...ADMIN_SHELL_NAMESPACES, "admin.pushTest"]}>
      <div className="mx-auto flex w-full max-w-page flex-1 flex-col gap-section p-inset">
        <PageHeader title={t("title")} backHref="/admin/settings" />
        <PushTestForm targets={targets} configured={pushConfig() !== null} />
      </div>
    </ScopedIntlProvider>
  );
}
