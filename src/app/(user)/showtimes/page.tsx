import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { LoadingState } from "@/components/loading-state";
import { ShowtimeCard } from "@/components/movie/showtime-card";
import { FILTER_KEYS, ShowtimeFilters, type FilterValues } from "@/components/movie/showtime-filters";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/guards";
import { formatDayKey } from "@/lib/datetime";
import { vietnamToday } from "@/lib/movie/status";
import { TIME_SLOTS, datesBetween, type TimeSlot } from "@/lib/showtime/time";
import { cn } from "@/lib/utils";
import { isCalendarDate } from "@/lib/validation/fields";
import { branchService } from "@/services/master-data/branch.service";
import { getBrandOptions } from "@/services/master-data/brand-options";
import { formatService } from "@/services/master-data/format.service";
import { genreService } from "@/services/master-data/genre.service";
import { listMovies } from "@/services/movie.service";
import { searchShowtimes } from "@/services/showtime.service";

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

  const [movies, branches, brands, genres, formats] = await Promise.all([
    listMovies({}),
    branchService.list({}),
    getBrandOptions(),
    genreService.list({}),
    formatService.list({}),
  ]);
  const brandName = new Map(brands.map((b) => [b.id, b.name]));
  const en = locale === "en";
  const options = {
    movie: movies.filter((m) => m.status !== "ended").map((m) => ({ value: m._id.toString(), label: m.title })),
    branch: branches.map((b) => ({ value: b._id.toString(), label: [brandName.get(b.brandId.toString()), b.name].filter(Boolean).join(" · ") })),
    genre: genres.map((g) => ({ value: g._id.toString(), label: en && g.nameEn ? g.nameEn : g.name })),
    format: formats.map((f) => ({ value: f._id.toString(), label: f.name })),
    slot: TIME_SLOTS.map((slot) => ({ value: slot, label: t(`slots.${slot}`) })),
  };
  const nowShowing = movies.filter((m) => m.status !== "ended");
  const days = datesBetween(today, new Date(Date.parse(`${today}T00:00:00Z`) + DAYS_AHEAD * 86_400_000).toISOString().slice(0, 10));
  const query = (day: string) => `/showtimes?${new URLSearchParams({ date: day, ...Object.fromEntries(Object.entries(values)) })}`;
  const dayLabel = new Intl.DateTimeFormat(en ? "en-GB" : "vi-VN", { timeZone: "UTC", weekday: "short" });

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <PageHeader title={t("title")} />

      {nowShowing.length > 0 ? (
        <section aria-label={t("movies")} className="flex flex-col gap-2">
          <h2 className="text-sm text-muted-foreground">{t("movies")}</h2>
          <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {nowShowing.map((movie) => (
              <li key={movie._id.toString()} className="w-24 shrink-0">
                <Link href={`/movies/${movie._id.toString()}`} className="flex flex-col gap-1.5">
                  <span className="relative block aspect-[2/3] overflow-hidden rounded-lg border bg-muted">
                    {movie.posterUrl ? <Image src={movie.posterUrl} alt="" fill sizes="96px" unoptimized className="object-cover" /> : null}
                  </span>
                  <span className="line-clamp-2 text-sm leading-snug">{movie.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <nav aria-label={t("dayStrip")} className="-mx-4">
        <ul className="flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                    "flex h-target min-w-14 flex-col items-center justify-center rounded-xl border px-2 text-xs leading-tight",
                    selected ? "border-transparent bg-primary text-primary-foreground" : "bg-card text-muted-foreground",
                  )}
                >
                  <span>{day === today ? t("today") : dayLabel.format(new Date(`${day}T00:00:00Z`))}</span>
                  <span className="text-base font-semibold">{Number(day.slice(8))}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <ShowtimeFilters date={date} values={values} options={options} />

      <h2 className="text-base font-semibold">{formatDayKey(date, locale)}</h2>
      <Suspense key={`${date}|${JSON.stringify(values)}`} fallback={<LoadingState compact />}>
        <Results date={date} values={values} />
      </Suspense>
    </div>
  );
}

async function Results({ date, values }: { date: string; values: FilterValues }) {
  const t = await getTranslations("showtimes");
  const slot = TIME_SLOTS.find((s) => s === values.slot) as TimeSlot | undefined;
  const rows = await searchShowtimes({ date, movieId: values.movie, branchId: values.branch, genreId: values.genre, formatId: values.format, slot });
  if (rows.length === 0) {
    return <EmptyState mascot="bubu-sleepy" title={t("emptyTitle")} description={t("emptyDescription")} />;
  }
  const byMovie = new Map<string, typeof rows>();
  for (const row of rows) byMovie.set(row.movie.id, [...(byMovie.get(row.movie.id) ?? []), row]);
  return (
    <div className="flex flex-col gap-6">
      {[...byMovie.values()].map((group) => (
        <section key={group[0].movie.id} className="flex flex-col gap-2">
          <Link href={`/movies/${group[0].movie.id}`} className="text-xl font-semibold">
            {group[0].movie.title}
          </Link>
          <ul className="flex flex-col gap-2">
            {group.map((row) => (
              <ShowtimeCard key={row.id} row={row} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
