import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { OfflineRetry } from "@/components/offline-retry";
import { ScopedIntlProvider } from "@/components/scoped-intl-provider";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("offline");
  return { title: t("title") };
}

/** Shown when visiting /offline directly (service worker offline navigations serve static /offline.html). */
export default async function OfflinePage() {
  const t = await getTranslations("offline");
  return (
    <ScopedIntlProvider namespaces={["offline"]}>
      <main className="flex min-h-dvh items-center justify-center px-inset pt-(--inset-top) pb-(--inset-bottom)">
        <EmptyState mascot="bubu-sleepy" title={t("title")} description={t("description")} action={<OfflineRetry />} />
      </main>
    </ScopedIntlProvider>
  );
}
