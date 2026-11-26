import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { after } from "next/server";
import { EmptyState } from "@/components/empty-state";
import { NotificationList } from "@/components/notification-list";
import { PageHeader } from "@/components/page-header";
import { ScopedIntlProvider } from "@/components/scoped-intl-provider";
import { requireUser } from "@/lib/auth/guards";
import { renderNotification } from "@/notifications/render";
import { sweepDueNotifications } from "@/notifications/sweep";
import { listNotifications } from "@/services/notification.service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("notifications");
  return { title: t("title") };
}

export default async function NotificationsPage() {
  const user = await requireUser();
  after(() => sweepDueNotifications().catch(() => undefined));
  const [t, types, rows, locale] = await Promise.all([
    getTranslations("notifications"),
    getTranslations("notifications.types"),
    listNotifications(user.userId),
    getLocale(),
  ]);
  const items = rows.map((row) => ({
    id: row.id,
    type: row.type,
    createdAt: row.createdAt,
    read: row.read,
    ...renderNotification((key, values) => types(key as never, values as never), row.type, row.payload, locale),
  }));

  return (
    <ScopedIntlProvider namespaces={["notifications"]}>
      <div className="flex w-full flex-1 flex-col gap-section p-inset">
        <PageHeader title={t("title")} backHref="/" />
        {items.length === 0 ? <EmptyState className="flex-1 justify-center" mascot="bubu-sleepy" title={t("emptyTitle")} description={t("emptyDescription")} /> : <NotificationList items={items} />}
      </div>
    </ScopedIntlProvider>
  );
}
