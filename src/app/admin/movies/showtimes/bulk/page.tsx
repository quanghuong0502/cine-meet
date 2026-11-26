import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { ShowtimeBulkForm } from "@/components/admin/showtime-bulk-form";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { ADMIN_SHELL_NAMESPACES, ScopedIntlProvider } from "@/components/scoped-intl-provider";
import { Button } from "@/components/ui/button";
import { resolveBackHref } from "@/lib/admin/back-href";
import { vietnamToday } from "@/lib/movie/status";
import { listAuditoriums } from "@/services/auditorium.service";
import { branchService } from "@/services/master-data/branch.service";
import { getBrandOptions } from "@/services/master-data/brand-options";
import { formatService } from "@/services/master-data/format.service";
import { listMovies } from "@/services/movie.service";
import { BULK_MAX_SHOWTIMES } from "@/services/showtime.service";
import { createShowtimesAction } from "../../actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.movies.bulk");
  return { title: t("title") };
}

export default async function BulkShowtimesPage({ searchParams }: { searchParams: Promise<{ back?: string }> }) {
  const t = await getTranslations("admin.movies.bulk");
  const locale = await getLocale();
  const { back } = await searchParams;
  const backHref = resolveBackHref(back, "/admin/movies/showtimes");

  const [movies, formats, rooms, branches, brands] = await Promise.all([
    listMovies({}),
    formatService.list({}),
    listAuditoriums(),
    branchService.list({}),
    getBrandOptions(),
  ]);
  const inactiveBranches = new Set(branches.filter((b) => b.active === false).map((b) => b._id.toString()));
  const roomsReady = rooms.filter((room) => room.currentLayoutId && !inactiveBranches.has(room.branchId));

  if (movies.length === 0 || formats.every((f) => f.active === false) || roomsReady.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-page flex-1 flex-col gap-section p-inset">
        <PageHeader title={t("title")} backHref={backHref} />
        <EmptyState
          title={t("needSetup.title")}
          description={t("needSetup.description")}
          action={
            <Button asChild size="pill">
              <Link href="/admin/movies">{t("needSetup.action")}</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const brandName = new Map(brands.map((b) => [b.id, b.name]));
  const branchName = new Map(branches.map((b) => [b._id.toString(), [brandName.get(b.brandId.toString()), b.name].filter(Boolean).join(" · ")]));

  return (
    <ScopedIntlProvider namespaces={[...ADMIN_SHELL_NAMESPACES, "admin.movies.bulk", "dateTimeField"]}>
      <div className="mx-auto flex w-full max-w-page flex-1 flex-col gap-section p-inset">
        <PageHeader title={t("title")} backHref={backHref} />
        <ShowtimeBulkForm
          movies={movies.filter((m) => m.status !== "ended").map((m) => ({ value: m._id.toString(), label: m.title }))}
          formats={formats.filter((f) => f.active !== false).map((f) => ({ value: f._id.toString(), label: f.name }))}
          rooms={roomsReady
            .map((r) => ({ value: r.id, label: r.name, group: branchName.get(r.branchId) ?? "" }))
            .sort((a, b) =>
              `${a.group} ${a.label}`.localeCompare(`${b.group} ${b.label}`, locale === "en" ? "en" : "vi"),
            )}
          backHref={backHref}
          action={createShowtimesAction}
          today={vietnamToday()}
          maxShowtimes={BULK_MAX_SHOWTIMES}
        />
      </div>
    </ScopedIntlProvider>
  );
}
