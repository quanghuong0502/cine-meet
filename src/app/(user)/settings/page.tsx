import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { InstallGuide } from "@/components/install-guide";
import { LanguageSetting } from "@/components/language-setting";
import { NotificationSettings } from "@/components/notification-settings";
import { PageHeader } from "@/components/page-header";
import { SecuritySetting } from "@/components/security-setting";
import { requireUser } from "@/lib/auth/guards";
import { pushConfig } from "@/notifications/push";
import { NOTIFICATION_TYPES } from "@/notifications/types";
import { getPushOff, listDevices } from "@/services/push.service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return { title: t("title") };
}

/** Everything about the account lives here: language, notifications, installing the app, password... */
export default async function SettingsPage() {
  const t = await getTranslations("settings");
  const user = await requireUser();
  const [devices, pushOff] = await Promise.all([listDevices(user.userId), getPushOff(user.userId)]);
  return (
    <div className="flex flex-col gap-group p-inset">
      <PageHeader title={t("title")} backHref="/profile" />
      <LanguageSetting />
      <NotificationSettings publicKey={pushConfig()?.publicKey ?? null} devices={devices} pushOff={pushOff} types={NOTIFICATION_TYPES} />
      <InstallGuide />
      <SecuritySetting hasPassword={user.hasPassword} />
    </div>
  );
}
