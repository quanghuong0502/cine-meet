import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AppearanceSettingsCard } from "@/components/admin/appearance-settings-card";
import { CinemaDimensionsCard } from "@/components/admin/cinema-dimensions-card";
import { PushSettingsCard } from "@/components/admin/push-settings-card";
import { PronounsSettingsCard } from "@/components/admin/pronouns-settings-card";
import { Room3DAppearanceCard } from "@/components/admin/room-3d-appearance-card";
import { RoomReportsCard } from "@/components/admin/room-reports-card";
import { SystemSettingsCard } from "@/components/admin/system-settings-card";
import { PageHeader } from "@/components/page-header";
import { LanguageSetting } from "@/components/language-setting";
import { SecuritySetting } from "@/components/security-setting";
import { requireAdmin } from "@/lib/auth/guards";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("placeholders.admin.settings");
  return { title: t("title") };
}

export default async function AdminSettingsPage() {
  const t = await getTranslations("placeholders.admin.settings");
  const admin = await requireAdmin();
  return (
    <div className="mx-auto flex w-full max-w-page flex-col gap-section p-inset">
      <PageHeader title={t("title")} />

      <section aria-labelledby="admin-settings-general" className="flex flex-col gap-item">
        <h2 id="admin-settings-general" className="type-label text-muted-foreground">
          {t("sections.general")}
        </h2>
        <div className="flex flex-col gap-group">
          <LanguageSetting />
          <AppearanceSettingsCard />
          <Room3DAppearanceCard />
          <PronounsSettingsCard />
        </div>
      </section>

      <section aria-labelledby="admin-settings-operations" className="flex flex-col gap-item">
        <h2 id="admin-settings-operations" className="type-label text-muted-foreground">
          {t("sections.operations")}
        </h2>
        <div className="flex flex-col gap-group">
          <SystemSettingsCard />
          <CinemaDimensionsCard />
          <Suspense fallback={null}>
            <RoomReportsCard />
          </Suspense>
          <PushSettingsCard />
        </div>
      </section>

      {admin.hasPassword ? (
        <section aria-labelledby="admin-settings-account" className="flex flex-col gap-item">
          <h2 id="admin-settings-account" className="type-label text-muted-foreground">
            {t("sections.account")}
          </h2>
          <SecuritySetting hasPassword={admin.hasPassword} />
        </section>
      ) : null}
    </div>
  );
}
