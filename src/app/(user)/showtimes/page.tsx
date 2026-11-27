import { AltArrowRightIcon, Reel2Icon } from "@solar-icons/react/line-duotone";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { LoadingState } from "@/components/loading-state";
import { RemoteImage } from "@/components/remote-image";
import { AgeRatingBadge } from "@/components/movie/age-rating-badge";
import { ShowtimeCard } from "@/components/movie/showtime-card";
import { ShowtimeFilters } from "@/components/movie/showtime-filters";
import { PageHeader } from "@/components/page-header";
import { ScopedIntlProvider } from "@/components/scoped-intl-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/guards";
import { vietnamToday } from "@/lib/movie/status";
import { FILTER_KEYS, type FilterValues } from "@/lib/showtime/filters";
import { slotName, slotRange } from "@/lib/showtime/slots.helpers";
import { datesBetween } from "@/lib/showtime/time";
import { cn } from "@/lib/utils";
import { isCalendarDate } from "@/lib/validation/fields";
import { getBrandOptions } from "@/services/master-data/brand-options";
import {
  getCachedAgeRatings,
  getCachedBranches,
  getCachedFormats,
  getCachedGenres,
} from "@/services/master-data/catalog-cache";
import { listFilterMovies } from "@/services/movie.service";
import { getSystemSettings } from "@/services/settings.service";
import { listActiveShowtimeDays, listShowtimeFacets, searchShowtimes } from "@/services/showtime.service";
import { PX } from "@/lib/ui-sizes";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("showtimes");
  return { title: t("title") };
}

const DAYS_AHEAD = 14;

type SearchParams = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function ShowtimesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireUser();
  const today = vietnamToday();
  const days = datesBetween(today, new Date(Date.parse(`${today}T00:00:00Z`) + DAYS_AHEAD * 86_400_000).toISOString().slice(0, 10));
  const [t, locale, params, movies, ratings, activeDays] = await Promise.all([
    getTranslations("showtimes"),
    getLocale(),
    searchParams,
    listFilterMovies(),
    getCachedAgeRatings(),
    listActiveShowtimeDays(days[0]!, days[days.length - 1]!),
  ]);

  const requested = first(params.date);
  const date = requested && isCalendarDate(requested) ? requested : today;
  const values: FilterValues = {};
  for (const key of FILTER_KEYS) {
    const value = first(params[key]);
    if (value) values[key] = value;
  }

  const en = locale === "en";
  const nowShowing = movies;
  const ratingById = new Map(ratings.map((r) => [r.id, r]));
  const query = (day: string) => `/showtimes?${new URLSearchParams({ date: day, ...Object.fromEntries(Object.entries(values)) })}`;
  const currentHref = query(date);
  const dayLabel = new Intl.DateTimeFormat(en ? "en-GB" : "vi-VN", { timeZone: "UTC", weekday: "short" });

  return (
    <ScopedIntlProvider namespaces={["showtimes"]}>
      <div className="flex flex-1 flex-col gap-section p-inset pb-action-clear">
      <PageHeader title={t("title")} />

      {nowShowing.length > 0 ? (
        <section aria-label={t("movies")}>
          <ul className="scroll-strip flex gap-item pb-tight">
            {nowShowing.map((movie, index) => (
              <li key={movie._id.toString()} className="w-[calc((100%-var(--spacing-item))*0.36)] shrink-0">
                <Link
                  href={`/movies/${movie._id.toString()}?back=${encodeURIComponent(currentHref)}`}
                  prefetch={false}
                  className="flex flex-col gap-stack rounded-lg transition-opacity outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:opacity-80"
                >
                  <span className="relative flex aspect-[2/3] items-center justify-center overflow-hidden rounded-lg border bg-muted">
                    {movie.ageRatingId && ratingById.get(movie.ageRatingId.toString()) ? (
                      <AgeRatingBadge rating={ratingById.get(movie.ageRatingId.toString())!} className="absolute top-stack left-stack z-10" />
                    ) : null}
                    {movie.status === "upcoming" ? (
                      <Badge variant="secondary" className="absolute bottom-stack left-stack z-10 bg-background/90">
                        {t("upcomingBadge")}
                      </Badge>
                    ) : null}
                    {movie.posterUrl ? (
                      <RemoteImage
                        src={movie.posterUrl}
                        alt=""
                        fill
                        sizes={`(max-width: ${PX.column}px) 36vw, ${PX.posterStripMax}px`}
                        loading={index < 3 ? "eager" : "lazy"}
                        fetchPriority={index === 0 ? "high" : undefined}
                        className="object-cover"
                      />
                    ) : (
                      <Reel2Icon className="size-icon-lg text-muted-foreground" aria-hidden />
                    )}
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
          {days.map((day, index) => {
            const selected = day === date;
            const hasShowtimes = activeDays.has(day);
            const monthChanged = index > 0 && day.slice(5, 7) !== days[index - 1]?.slice(5, 7);
            const dayNum = Number(day.slice(8));
            const monthNum = Number(day.slice(5, 7));
            return (
              <li key={day} className="shrink-0">
                <Link
                  href={query(day)}
                  prefetch={false}
                  replace
                  scroll={false}
                  aria-current={selected ? "date" : undefined}
                  className={cn(
                    "flex min-h-row min-w-row flex-col items-center justify-center gap-tight rounded-xl border px-inset py-inset-xs type-micro leading-tight! transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:opacity-80",
                    selected
                      ? "border-transparent bg-primary text-primary-foreground"
                      : hasShowtimes
                        ? "bg-card text-muted-foreground hover:text-foreground"
                        : "bg-card text-muted-foreground/60 hover:text-foreground",
                  )}
                >
                  <span>{day === today ? t("today") : dayLabel.format(new Date(`${day}T00:00:00Z`))}</span>
                  <span className="type-item-title tabular-nums">{monthChanged ? `${dayNum}/${monthNum}` : dayNum}</span>
                  <span
                    aria-hidden
                    className={cn(
                      "h-hair w-stack rounded-full",
                      hasShowtimes ? (selected ? "bg-primary-foreground" : "bg-primary") : "bg-transparent",
                    )}
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <Suspense key={date} fallback={<div className="min-h-target" aria-hidden />}>
        <FiltersBar date={date} values={values} locale={locale} />
      </Suspense>
      <Suspense key={`${date}|${JSON.stringify(values)}`} fallback={<LoadingState compact />}>
        <Results date={date} values={values} currentHref={currentHref} />
      </Suspense>
      </div>
    </ScopedIntlProvider>
  );
}

async function FiltersBar({ date, values, locale }: { date: string; values: FilterValues; locale: string }) {
  const [branches, brands, genres, formats, settings, facets] = await Promise.all([
    getCachedBranches(),
    getBrandOptions(),
    getCachedGenres(),
    getCachedFormats(),
    getSystemSettings(),
    listShowtimeFacets(date),
  ]);
  const brandName = new Map(brands.map((b) => [b.id, b.name]));
  const brandActive = new Map(brands.map((b) => [b.id, b.active]));
  const en = locale === "en";
  const options = {
    branch: branches.filter((b) => b.active && brandActive.get(b.brandId) !== false).map((b) => ({ value: b.id, label: [brandName.get(b.brandId), b.name].filter(Boolean).join(" · ") })),
    genre: genres.filter((g) => g.active).map((g) => ({ value: g.id, label: en && g.nameEn ? g.nameEn : g.name })),
    format: formats.filter((f) => f.active).map((f) => ({ value: f.id, label: f.name })),
    slot: settings.timeSlots.map((slot) => ({ value: slot.id, label: `${slotName(slot, locale)} (${slotRange(slot)})` })),
  };
  return <ShowtimeFilters date={date} values={values} options={options} records={facets} />;
}

async function Results({ date, values, currentHref }: { date: string; values: FilterValues; currentHref: string }) {
  const t = await getTranslations("showtimes");
  const rows = await searchShowtimes({ date, branchId: values.branch, genreId: values.genre, formatId: values.format, slot: values.slot });
  const hasFilters = FILTER_KEYS.some((key) => Boolean(values[key]));
  if (rows.length === 0) {
    return (
      <EmptyState
        mascot="bubu-sleepy"
        title={t("emptyTitle")}
        description={t("emptyDescription")}
        action={
          hasFilters ? (
            <Button asChild size="pill">
              <Link href={`/showtimes?date=${date}`} replace>
                {t("filters.clear")}
              </Link>
            </Button>
          ) : undefined
        }
      />
    );
  }
  const byMovie = new Map<string, typeof rows>();
  for (const row of rows) {
    const group = byMovie.get(row.movie.id);
    if (group) group.push(row);
    else byMovie.set(row.movie.id, [row]);
  }
  return (
    <div className="flex flex-col gap-section">
      {[...byMovie.values()].map((group) => (
        <section key={group[0].movie.id} className="flex flex-col gap-item">
          <h2 className="type-heading">
            <Link
              href={`/movies/${group[0].movie.id}?back=${encodeURIComponent(currentHref)}`}
              prefetch={false}
              className="flex min-h-target items-center justify-between gap-stack rounded-lg py-tight transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:opacity-75"
            >
              <span className="min-w-0 flex-1">{group[0].movie.title}</span>
              <AltArrowRightIcon className="size-icon shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </h2>
          <ul className="flex flex-col gap-item">
            {group.map((row) => (
              <ShowtimeCard key={row.id} row={row} backHref={currentHref} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
