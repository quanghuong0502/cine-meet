import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { AltArrowRightIcon, MapPointIcon } from "@solar-icons/react/line-duotone";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { ListThumb } from "@/components/list-thumb";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import { ScopedIntlProvider } from "@/components/scoped-intl-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CinemaFilters } from "@/components/cinema-filters";
import { requireUser } from "@/lib/auth/guards";
import { CINEMA_FILTER_KEYS, filterCinemas, type CinemaFilterValues } from "@/lib/cinema/filters";
import { formatVnd } from "@/lib/money";
import { getBrandOptions } from "@/services/master-data/brand-options";
import { getCachedFormats } from "@/services/master-data/catalog-cache";
import { listCinemaList, type CinemaListItem } from "@/services/cinema.service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("cinemas");
  return { title: t("title") };
}

type SearchParams = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function CinemasPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [user, t, params] = await Promise.all([requireUser(), getTranslations("cinemas"), searchParams]);
  const values: CinemaFilterValues = {};
  for (const key of CINEMA_FILTER_KEYS) {
    const value = first(params[key]);
    if (value) values[key] = value;
  }

  return (
    <ScopedIntlProvider namespaces={["cinemas.filters"]}>
      <div className="flex flex-1 flex-col gap-section p-inset pb-action-clear">
        <PageHeader title={t("title")} />
        <Suspense key={JSON.stringify(values)} fallback={<LoadingState compact />}>
          <CinemasContent userId={user.userId} values={values} />
        </Suspense>
      </div>
    </ScopedIntlProvider>
  );
}

async function CinemasContent({ userId, values }: { userId: string; values: CinemaFilterValues }) {
  const [t, locale, all, brands, formats] = await Promise.all([
    getTranslations("cinemas"),
    getLocale(),
    listCinemaList(userId),
    getBrandOptions(),
    getCachedFormats(),
  ]);
  const visible = filterCinemas(all, values);
  const options = {
    brand: brands.filter((b) => b.active).map((b) => ({ value: b.id, label: b.name })),
    format: formats.filter((f) => f.active).map((f) => ({ value: f.id, label: f.name })),
    frequent: [{ value: "1", label: t("filters.frequentOption") }],
  };
  // Strip full branch objects down to the 3 facet fields needed by CinemaFilters (avoids duplicating entity payload across RSC boundary).
  const facetRecords = all.map(({ brand, format, frequent }) => ({ brand, format, frequent }));

  const activeSearch = new URLSearchParams();
  for (const key of CINEMA_FILTER_KEYS) if (values[key]) activeSearch.set(key, values[key] as string);
  const backParam = activeSearch.size > 0 ? `?back=${encodeURIComponent(`/cinemas?${activeSearch}`)}` : "";

  function branchCard(branch: CinemaListItem) {
    return (
      <li key={branch.id} className="list-card-cv">
        <Link
          href={`/cinemas/${branch.id}${backParam}`}
          prefetch={false}
          className="flex min-h-row items-center gap-item rounded-xl border bg-card p-inset-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-muted/60"
        >
          <ListThumb imageUrl={branch.imageUrl ?? undefined} />
          <div className="flex min-w-0 flex-1 flex-col gap-stack">
            <div className="flex flex-col gap-hair">
              {branch.brandName ? <span className="type-caption text-muted-foreground">{branch.brandName}</span> : null}
              <span className="type-item-title">{branch.name}</span>
            </div>
            {branch.address ? (
              <span className="flex items-start gap-stack type-secondary text-muted-foreground">
                <MapPointIcon className="mt-hair size-icon-sm shrink-0" aria-hidden />
                {branch.address}
              </span>
            ) : null}
            <span className="flex flex-wrap gap-stack">
              {branch.frequent.length > 0 ? <Badge variant="accent">{t("filters.frequentOption")}</Badge> : null}
              {branch.roomCount !== undefined ? <Badge variant="secondary">{t("roomCount", { count: branch.roomCount })}</Badge> : null}
              {branch.parkingFee !== null ? <Badge variant="outline" className="tabular-nums">{t("parkingFee", { fee: formatVnd(branch.parkingFee, locale) })}</Badge> : null}
            </span>
          </div>
          <AltArrowRightIcon className="size-icon-sm shrink-0 text-muted-foreground" aria-hidden />
        </Link>
      </li>
    );
  }

  if (all.length === 0) {
    return <EmptyState mascot="bubu-sleepy" title={t("emptyTitle")} description={t("emptyDescription")} />;
  }

  return (
    <>
      <CinemaFilters values={values} options={options} records={facetRecords} />
      {visible.length === 0 ? (
        <EmptyState
          mascot="bubu-sleepy"
          title={t("filters.emptyTitle")}
          description={t("filters.emptyDescription")}
          action={
            activeSearch.size > 0 ? (
              <Button asChild size="pill">
                <Link href="/cinemas" replace>
                  {t("filters.clear")}
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="flex flex-col gap-item">{visible.map((branch) => branchCard(branch))}</ul>
      )}
    </>
  );
}
