import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { MapPin } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { ListThumb } from "@/components/list-thumb";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { CinemaFilters } from "@/components/cinema-filters";
import { requireUser } from "@/lib/auth/guards";
import { CINEMA_FILTER_KEYS, filterCinemas, type CinemaFilterValues } from "@/lib/cinema/filters";
import { formatVnd } from "@/lib/money";
import { getBrandOptions } from "@/services/master-data/brand-options";
import { formatService } from "@/services/master-data/format.service";
import { listCinemaList, type CinemaListItem } from "@/services/cinema.service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("cinemas");
  return { title: t("title") };
}

type SearchParams = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function CinemasPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser();
  const t = await getTranslations("cinemas");
  const locale = await getLocale();
  const params = await searchParams;
  const values: CinemaFilterValues = {};
  for (const key of CINEMA_FILTER_KEYS) {
    const value = first(params[key]);
    if (value) values[key] = value;
  }
  const [all, brands, formats] = await Promise.all([listCinemaList(user.userId), getBrandOptions(), formatService.list({})]);
  const visible = filterCinemas(all, values);
  const options = {
    brand: brands.filter((b) => b.active).map((b) => ({ value: b.id, label: b.name })),
    format: formats.filter((f) => f.active !== false).map((f) => ({ value: f._id.toString(), label: f.name })),
    frequent: [{ value: "1", label: t("filters.frequentOption") }],
  };

  function branchCard(branch: CinemaListItem) {
    return (
      <li key={branch.id}>
        <Link href={`/cinemas/${branch.id}`} className="flex min-h-row items-center gap-item rounded-xl border bg-card p-inset-sm">
          <ListThumb imageUrl={branch.imageUrl ?? undefined} />
          <div className="flex min-w-0 flex-1 flex-col gap-stack">
            <span className="type-item-title">{branch.name}</span>
            {branch.address ? (
              <span className="flex items-start gap-stack type-secondary text-muted-foreground">
                <MapPin className="mt-hair size-icon-sm shrink-0" aria-hidden />
                {branch.address}
              </span>
            ) : null}
            <span className="flex flex-wrap gap-stack">
              {branch.roomCount !== undefined ? <Badge variant="secondary">{t("roomCount", { count: branch.roomCount })}</Badge> : null}
              {branch.parkingFee !== null ? <Badge variant="outline">{t("parkingFee", { fee: formatVnd(branch.parkingFee, locale) })}</Badge> : null}
            </span>
          </div>
        </Link>
      </li>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-section p-inset pb-action-clear">
      <PageHeader title={t("title")} />
      {all.length === 0 ? (
        <EmptyState mascot="bubu-sleepy" title={t("emptyTitle")} description={t("emptyDescription")} />
      ) : (
        <>
          <CinemaFilters values={values} options={options} records={all} />
          {visible.length === 0 ? (
            <EmptyState mascot="bubu-sleepy" title={t("filters.emptyTitle")} description={t("filters.emptyDescription")} />
          ) : (
            <ul className="flex flex-col gap-stack">{visible.map((branch) => branchCard(branch))}</ul>
          )}
        </>
      )}
    </div>
  );
}
