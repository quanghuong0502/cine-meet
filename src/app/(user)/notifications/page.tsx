import { SettingsIcon } from "@solar-icons/react/line-duotone";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { NotificationList } from "@/components/notification-list";
import { PageHeader } from "@/components/page-header";
import { ScopedIntlProvider } from "@/components/scoped-intl-provider";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/guards";
import { resolveUserBackHref } from "@/lib/user-back-href";
import { renderNotification } from "@/notifications/render";
import { sweepDueNotifications } from "@/notifications/sweep";
import { listNotifications } from "@/services/notification.service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("notifications");
  return { title: t("title") };
}

type SearchParams = Record<string, string | string[] | undefined>;

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  // Await throttled sweep (30s cooldown) so scheduled reminders that just came due show up on first visit.
  await sweepDueNotifications().catch(() => undefined);
  const [t, types, rows, locale] = await Promise.all([
    getTranslations("notifications"),
    getTranslations("notifications.types"),
    listNotifications(user.userId),
    getLocale(),
  ]);
  const backHref = resolveUserBackHref(params.back, "/");
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
        <PageHeader title={t("title")} backHref={backHref}>
          <Button asChild variant="ghost" size="icon" aria-label={t("settingsAction")}>
            <Link href="/settings?back=/notifications" prefetch={false}>
              <SettingsIcon className="size-icon-lg" aria-hidden />
            </Link>
          </Button>
        </PageHeader>
        {items.length === 0 ? <EmptyState className="flex-1 justify-center" mascot="bubu-sleepy" title={t("emptyTitle")} description={t("emptyDescription")} /> : <NotificationList items={items} />}
      </div>
    </ScopedIntlProvider>
  );
}
