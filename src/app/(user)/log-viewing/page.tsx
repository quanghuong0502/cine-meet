import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LogViewingForm } from "@/components/log-viewing-form";
import { ManualViewingList } from "@/components/manual-viewing-list";
import { PageHeader } from "@/components/page-header";
import { ScopedIntlProvider } from "@/components/scoped-intl-provider";
import { requireUser } from "@/lib/auth/guards";
import { listRoomOptions } from "@/services/cinema.service";
import { listRecentManualViewings } from "@/services/expense.service";
import { listMovieTitles } from "@/services/movie.service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard.logViewing");
  return { title: t("title") };
}

export default async function LogViewingPage() {
  const user = await requireUser();
  const [t, movies, rooms, recent] = await Promise.all([
    getTranslations("dashboard.logViewing"),
    listMovieTitles(),
    listRoomOptions(),
    listRecentManualViewings(user.userId),
  ]);
  return (
    <ScopedIntlProvider namespaces={["dashboard.logViewing", "dateTimeField", "confirmDialog"]}>
      <div className="flex w-full flex-1 flex-col gap-section p-inset">
        <PageHeader title={t("title")} backHref="/" />
        <div className="mx-auto flex w-full max-w-form flex-1 flex-col gap-section">
          <LogViewingForm movies={movies} rooms={rooms} />
          <ManualViewingList initialRows={recent} />
          <div aria-hidden className="h-save-clear shrink-0" />
        </div>
      </div>
    </ScopedIntlProvider>
  );
}
