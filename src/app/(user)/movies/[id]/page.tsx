import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Image from "next/image";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { AgeRatingBadge } from "@/components/movie/age-rating-badge";
import { MovieShowtimes } from "@/components/movie/movie-showtimes";
import { TrailerSheet } from "@/components/movie/trailer-sheet";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth/guards";
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

  const facts: [string, string | undefined][] = [
    [t("synopsis"), movie.synopsis ?? undefined],
    [t("director"), movie.director ?? undefined],
    [t("cast"), movie.cast ?? undefined],
    [t("language"), movie.language ?? undefined],
  ];

  return (
    <div className="flex flex-1 flex-col gap-6 p-4">
      <PageHeader backHref="/showtimes" />

      <section className="flex gap-4">
        <div className="relative aspect-[2/3] w-32 shrink-0 overflow-hidden rounded-xl border bg-muted">
          {movie.posterUrl ? <Image src={movie.posterUrl} alt={t("posterAlt", { title: movie.title })} fill sizes="128px" unoptimized className="object-cover" priority /> : null}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h1 className="text-xl font-semibold tracking-tight">{movie.title}</h1>
          {movie.originalTitle ? <p className="text-sm text-muted-foreground">{movie.originalTitle}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Badge variant={movie.status === "showing" ? "default" : "secondary"} className="h-auto py-0.5 text-xs font-medium">
              {t(`status.${movie.status}`)}
            </Badge>
            {rating ? <AgeRatingBadge rating={rating} /> : null}
          </div>
          <p className="text-sm">{t("duration", { minutes: movie.durationMin })}</p>
          <p className="text-sm text-muted-foreground">{t("releaseOn", { date: formatDay(movie.releaseDate, locale) })}</p>
          {genreNames.length > 0 ? (
            <p aria-label={t("genres")} className="flex flex-wrap gap-1.5">
              {genreNames.map((name) => (
                <Badge key={name} variant="secondary" className="h-auto py-0.5 text-xs font-medium">
                  {name}
                </Badge>
              ))}
            </p>
          ) : null}
          {formatNames.length > 0 ? (
            <p aria-label={t("formats")} className="flex flex-wrap gap-1.5">
              {formatNames.map((name) => (
                <Badge key={name} variant="secondary" className="h-auto py-0.5 text-xs font-medium">
                  {name}
                </Badge>
              ))}
            </p>
          ) : null}
          {movie.trailer ? <TrailerSheet videoId={movie.trailer.videoId} title={movie.title} /> : null}
        </div>
      </section>

      <dl className="flex flex-col gap-3 text-sm">
        {facts
          .filter((fact): fact is [string, string] => Boolean(fact[1]))
          .map(([label, value]) => (
            <div key={label} className="flex flex-col gap-1.5">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="text-base whitespace-pre-line">{value}</dd>
            </div>
          ))}
      </dl>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">{t("showtimes")}</h2>
        {showtimes.length === 0 ? (
          <EmptyState mascot="bubu-sleepy" title={t("noShowtimes.title")} description={t("noShowtimes.description")} />
        ) : (
          <MovieShowtimes rows={showtimes} />
        )}
      </section>
    </div>
  );
}
