import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BudgetSetting } from "@/components/budget-setting";
import { LanguageSetting } from "@/components/language-setting";
import { NotificationSettings } from "@/components/notification-settings";
import { PageHeader } from "@/components/page-header";
import { ScopedIntlProvider } from "@/components/scoped-intl-provider";
import { SecuritySetting } from "@/components/security-setting";
import { requireUser } from "@/lib/auth/guards";
import { oneSignalConfig, pushProvider } from "@/notifications/provider";
import { pushConfig } from "@/notifications/push";
import { NOTIFICATION_TYPES } from "@/notifications/types";
import { listDevices } from "@/services/push.service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return { title: t("title") };
}

/** Everything about the account lives here: language, notifications, installing the app, password... */
export default async function SettingsPage() {
  const [t, user] = await Promise.all([getTranslations("settings"), requireUser()]);
  const devices = await listDevices(user.userId);
  return (
    <ScopedIntlProvider namespaces={["settings"]}>
      <div className="flex flex-col gap-section p-inset">
        <PageHeader title={t("title")} backHref="/profile" />
        <LanguageSetting />
        <BudgetSetting initial={user.monthlyBudget ?? null} />
        <SecuritySetting hasPassword={user.hasPassword} />
        <NotificationSettings
          provider={pushProvider()}
          publicKey={pushConfig()?.publicKey ?? null}
          oneSignalAppId={oneSignalConfig()?.appId ?? null}
          devices={devices}
          pushOff={user.pushOff}
          types={NOTIFICATION_TYPES}
        />
      </div>
    </ScopedIntlProvider>
  );
}
