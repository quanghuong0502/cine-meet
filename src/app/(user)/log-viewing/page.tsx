import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LogViewingForm } from "@/components/log-viewing-form";
import { PageHeader } from "@/components/page-header";
import { ScopedIntlProvider } from "@/components/scoped-intl-provider";
import { requireUser } from "@/lib/auth/guards";
import { listRoomOptions } from "@/services/cinema.service";
import { listMovies } from "@/services/movie.service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard.logViewing");
  return { title: t("title") };
}

export default async function LogViewingPage() {
  await requireUser();
  const t = await getTranslations("dashboard.logViewing");
  const [movies, rooms] = await Promise.all([listMovies({}), listRoomOptions()]);
  return (
    <ScopedIntlProvider namespaces={["dashboard.logViewing", "dateTimeField"]}>
      <div className="flex w-full flex-1 flex-col gap-section p-inset">
        <PageHeader title={t("title")} backHref="/" />
        <div className="mx-auto flex w-full max-w-form flex-1 flex-col">
          <LogViewingForm movies={movies.map((m) => ({ id: m._id.toString(), title: m.title }))} rooms={rooms} />
        </div>
      </div>
    </ScopedIntlProvider>
  );
}
