import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Image from "next/image";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { ShowtimeCard } from "@/components/movie/showtime-card";
import { TrailerEmbed } from "@/components/movie/trailer-embed";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth/guards";
import { formatDayKey, vietnamDayKey } from "@/lib/datetime";
import { formatDay } from "@/app/admin/master-data/_sections/create-section";
import { ageRatingService } from "@/services/master-data/age-rating.service";
import { formatService } from "@/services/master-data/format.service";
import { genreService } from "@/services/master-data/genre.service";
import { getMovie } from "@/services/movie.service";
import { searchShowtimes } from "@/services/showtime.service";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const movie = await getMovie(id);
  return { title: movie?.title };
}

export default async function MovieDetailPage({ params }: Props) {
  await requireUser();
  const { id } = await params;
  const movie = await getMovie(id);
  if (!movie) notFound();
  const t = await getTranslations("movie");
  const locale = await getLocale();
  const en = locale === "en";

  const [genres, formats, ratings, showtimes] = await Promise.all([
    genreService.list({}),
    formatService.list({}),
    ageRatingService.list({}),
    searchShowtimes({ movieId: id, limit: 120 }),
  ]);
  const genreById = new Map(genres.map((g) => [g._id.toString(), g]));
  const formatById = new Map(formats.map((f) => [f._id.toString(), f]));
  const genreNames = (movie.genreIds ?? []).map((gid) => genreById.get(gid.toString())).filter((g) => g !== undefined).map((g) => (en && g.nameEn ? g.nameEn : g.name));
  const formatNames = (movie.formatIds ?? []).map((fid) => formatById.get(fid.toString())?.name).filter(Boolean);
  const rating = ratings.find((r) => r._id.toString() === movie.ageRatingId?.toString());

  const days = new Map<string, typeof showtimes>();
  for (const row of showtimes) {
    const key = vietnamDayKey(row.startAt);
    days.set(key, [...(days.get(key) ?? []), row]);
  }

  const facts: [string, string | undefined][] = [
    [t("director"), movie.director ?? undefined],
    [t("cast"), movie.cast ?? undefined],
    [t("language"), movie.language ?? undefined],
    [t("formats"), formatNames.join(", ") || undefined],
    [t("releaseDate"), formatDay(movie.releaseDate, locale)],
  ];

  return (
    <div className="flex flex-1 flex-col gap-6 p-4">
      <PageHeader title={movie.title} backHref="/showtimes" />

      <section className="flex gap-4">
        <div className="relative aspect-[2/3] w-28 shrink-0 overflow-hidden rounded-xl border bg-muted">
          {movie.posterUrl ? <Image src={movie.posterUrl} alt={t("posterAlt", { title: movie.title })} fill sizes="112px" unoptimized className="object-cover" priority /> : null}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {movie.originalTitle ? <p className="text-sm text-muted-foreground">{movie.originalTitle}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Badge variant={movie.status === "showing" ? "default" : "secondary"} className="h-auto py-0.5 text-xs font-medium">
              {t(`status.${movie.status}`)}
            </Badge>
            {rating ? (
              <Badge variant="outline" className="h-auto py-0.5 text-xs font-medium">
                {rating.code}
              </Badge>
            ) : null}
          </div>
          <p className="text-sm">{t("duration", { minutes: movie.durationMin })}</p>
          {genreNames.length > 0 ? <p className="text-sm text-muted-foreground">{genreNames.join(", ")}</p> : null}
        </div>
      </section>

      {movie.trailer ? <TrailerEmbed videoId={movie.trailer.videoId} title={movie.title} /> : null}

      {movie.synopsis ? <p className="text-base whitespace-pre-line">{movie.synopsis}</p> : null}

      <dl className="flex flex-col gap-3 text-sm">
        {facts
          .filter((fact): fact is [string, string] => Boolean(fact[1]))
          .map(([label, value]) => (
            <div key={label} className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="text-base">{value}</dd>
            </div>
          ))}
      </dl>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">{t("showtimes")}</h2>
        {days.size === 0 ? (
          <EmptyState mascot="bubu-sleepy" title={t("noShowtimes.title")} description={t("noShowtimes.description")} />
        ) : (
          [...days.entries()].map(([day, rows]) => (
            <div key={day} className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-muted-foreground">{formatDayKey(day, locale)}</h3>
              <ul className="flex flex-col gap-2">
                {rows.map((row) => (
                  <ShowtimeCard key={row.id} row={row} />
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
