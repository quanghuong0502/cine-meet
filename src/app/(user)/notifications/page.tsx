import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { NotificationList } from "@/components/notification-list";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/guards";
import { renderNotification } from "@/notifications/render";
import { listNotifications } from "@/services/notification.service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("notifications");
  return { title: t("title") };
}

export default async function NotificationsPage() {
  const user = await requireUser();
  const t = await getTranslations("notifications");
  const types = await getTranslations("notifications.types");
  const [rows, locale] = [await listNotifications(user.userId), await getLocale()];
  const items = rows.map((row) => ({
    id: row.id,
    createdAt: row.createdAt,
    read: row.read,
    ...renderNotification((key, values) => types(key as never, values as never), row.type, row.payload, locale),
  }));

  return (
    <div className="flex w-full flex-1 flex-col gap-section p-inset">
      <PageHeader title={t("title")} backHref="/" />
      {items.length === 0 ? <EmptyState className="flex-1 justify-center" mascot="bubu-sleepy" title={t("emptyTitle")} description={t("emptyDescription")} /> : <NotificationList items={items} />}
    </div>
  );
}
