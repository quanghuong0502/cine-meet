import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { OfflineRetry } from "@/components/offline-retry";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("offline");
  return { title: t("title") };
}

/** Shown by the service worker when a page cannot load for lack of network. Public (no sign-in) so it can be saved ahead of time. */
export default async function OfflinePage() {
  const t = await getTranslations("offline");
  return (
    <main className="flex min-h-dvh items-center justify-center p-inset">
      <EmptyState mascot="bubu-sleepy" title={t("title")} description={t("description")} action={<OfflineRetry />} />
    </main>
  );
}
