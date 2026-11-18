import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { LoadingState } from "@/components/loading-state";
import { AgeRatingBadge } from "@/components/movie/age-rating-badge";
import { ShowtimeCard } from "@/components/movie/showtime-card";
import { ShowtimeFilters } from "@/components/movie/showtime-filters";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/guards";
import { vietnamToday } from "@/lib/movie/status";
import { FILTER_KEYS, type FilterValues } from "@/lib/showtime/filters";
import { slotName, slotRange } from "@/lib/showtime/slots";
import { datesBetween } from "@/lib/showtime/time";
import { cn } from "@/lib/utils";
import { isCalendarDate } from "@/lib/validation/fields";
import { branchService } from "@/services/master-data/branch.service";
import { getBrandOptions } from "@/services/master-data/brand-options";
import { ageRatingService } from "@/services/master-data/age-rating.service";
import { formatService } from "@/services/master-data/format.service";
import { genreService } from "@/services/master-data/genre.service";
import { listFilterMovies } from "@/services/movie.service";
import { getSystemSettings } from "@/services/settings.service";
import { listShowtimeFacets, searchShowtimes } from "@/services/showtime.service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("showtimes");
  return { title: t("title") };
}

const DAYS_AHEAD = 14;

type SearchParams = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function ShowtimesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireUser();
  const t = await getTranslations("showtimes");
  const locale = await getLocale();
  const params = await searchParams;

  const today = vietnamToday();
  const requested = first(params.date);
  const date = requested && isCalendarDate(requested) ? requested : today;
  const values: FilterValues = {};
  for (const key of FILTER_KEYS) {
    const value = first(params[key]);
    if (value) values[key] = value;
  }

  const [movies, branches, brands, genres, formats, ratings, settings, facets] = await Promise.all([
    listFilterMovies(),
    branchService.list({}),
    getBrandOptions(),
    genreService.list({}),
    formatService.list({}),
    ageRatingService.list({}),
    getSystemSettings(),
    listShowtimeFacets(date),
  ]);
  const brandName = new Map(brands.map((b) => [b.id, b.name]));
  const brandActive = new Map(brands.map((b) => [b.id, b.active]));
  const en = locale === "en";
  const options = {
    branch: branches.filter((b) => b.active !== false && brandActive.get(b.brandId.toString()) !== false).map((b) => ({ value: b._id.toString(), label: [brandName.get(b.brandId.toString()), b.name].filter(Boolean).join(" · ") })),
    genre: genres.filter((g) => g.active !== false).map((g) => ({ value: g._id.toString(), label: en && g.nameEn ? g.nameEn : g.name })),
    format: formats.filter((f) => f.active !== false).map((f) => ({ value: f._id.toString(), label: f.name })),
    slot: settings.timeSlots.map((slot) => ({ value: slot.id, label: `${slotName(slot, locale)} (${slotRange(slot)})` })),
  };
  const nowShowing = movies;
  const ratingById = new Map(ratings.map((r) => [r._id.toString(), r]));
  const days = datesBetween(today, new Date(Date.parse(`${today}T00:00:00Z`) + DAYS_AHEAD * 86_400_000).toISOString().slice(0, 10));
  const query = (day: string) => `/showtimes?${new URLSearchParams({ date: day, ...Object.fromEntries(Object.entries(values)) })}`;
  const dayLabel = new Intl.DateTimeFormat(en ? "en-GB" : "vi-VN", { timeZone: "UTC", weekday: "short" });

  return (
    <div className="flex flex-1 flex-col gap-section p-inset pb-fab-clear">
      <PageHeader title={t("title")} />

      {nowShowing.length > 0 ? (
        <section aria-label={t("movies")}>
          <ul className="scroll-strip flex gap-item pb-tight">
            {nowShowing.map((movie) => (
              <li key={movie._id.toString()} className="w-[calc((100%-2*var(--spacing-item))/3)] shrink-0">
                <Link href={`/movies/${movie._id.toString()}`} className="flex flex-col gap-stack">
                  <span className="relative block aspect-[2/3] overflow-hidden rounded-lg border bg-muted">
                    {movie.ageRatingId && ratingById.get(movie.ageRatingId.toString()) ? (
                      <AgeRatingBadge rating={ratingById.get(movie.ageRatingId.toString())!} className="absolute top-1.5 left-1.5 z-10" />
                    ) : null}
                    {movie.posterUrl ? <Image src={movie.posterUrl} alt="" fill sizes="128px" unoptimized className="object-cover" /> : null}
                  </span>
                  <span className="line-clamp-2 type-secondary leading-snug!">{movie.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <nav aria-label={t("dayStrip")}>
        <ul className="scroll-strip flex gap-stack pb-tight">
          {days.map((day) => {
            const selected = day === date;
            return (
              <li key={day} className="shrink-0">
                <Link
                  href={query(day)}
                  replace
                  scroll={false}
                  aria-current={selected ? "date" : undefined}
                  className={cn(
                    "flex min-h-row min-w-row flex-col items-center justify-center gap-tight rounded-2xl border px-inset py-inset-xs type-micro leading-tight!",
                    selected ? "border-transparent bg-primary text-primary-foreground" : "bg-card text-muted-foreground",
                  )}
                >
                  <span>{day === today ? t("today") : dayLabel.format(new Date(`${day}T00:00:00Z`))}</span>
                  <span className="type-item-title">{Number(day.slice(8))}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <ShowtimeFilters date={date} values={values} options={options} records={facets} />
      <Suspense key={`${date}|${JSON.stringify(values)}`} fallback={<LoadingState compact />}>
        <Results date={date} values={values} />
      </Suspense>
    </div>
  );
}

async function Results({ date, values }: { date: string; values: FilterValues }) {
  const t = await getTranslations("showtimes");
  const rows = await searchShowtimes({ date, branchId: values.branch, genreId: values.genre, formatId: values.format, slot: values.slot });
  if (rows.length === 0) {
    return <EmptyState mascot="bubu-sleepy" title={t("emptyTitle")} description={t("emptyDescription")} />;
  }
  const byMovie = new Map<string, typeof rows>();
  for (const row of rows) byMovie.set(row.movie.id, [...(byMovie.get(row.movie.id) ?? []), row]);
  return (
    <div className="flex flex-col gap-section">
      {[...byMovie.values()].map((group) => (
        <section key={group[0].movie.id} className="flex flex-col gap-item">
          <Link href={`/movies/${group[0].movie.id}`} className="type-heading">
            {group[0].movie.title}
          </Link>
          <ul className="flex flex-col gap-item">
            {group.map((row) => (
              <ShowtimeCard key={row.id} row={row} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
