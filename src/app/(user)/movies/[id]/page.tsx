import { StarIcon as StarFilledIcon } from "@solar-icons/react/bold";
import { Reel2Icon } from "@solar-icons/react/line-duotone";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LoadingState } from "@/components/loading-state";
import { AgeRatingBadge } from "@/components/movie/age-rating-badge";
import { CollapsibleText } from "@/components/movie/collapsible-text";
import { MovieShowtimes } from "@/components/movie/movie-showtimes";
import { TrailerPlayer } from "@/components/movie/trailer-player";
import { PageHeader } from "@/components/page-header";
import { RemoteImage } from "@/components/remote-image";
import { ScopedIntlProvider } from "@/components/scoped-intl-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/guards";
import { resolveUserBackHref } from "@/lib/user-back-href";
import { formatDay } from "@/app/admin/master-data/_sections/create-section";
import { getCachedAgeRatings, getCachedFormats, getCachedGenres } from "@/services/master-data/catalog-cache";
import { getMovie } from "@/services/movie.service";
import { getMyMovieRating } from "@/services/rating.service";
import { searchShowtimes } from "@/services/showtime.service";
import { PX } from "@/lib/ui-sizes";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const movie = await getMovie(id);
  return { title: movie?.title };
}

export default async function MovieDetailPage({ params, searchParams }: Props) {
  const [user, { id }, sp] = await Promise.all([requireUser(), params, searchParams]);
  const [movie, t, locale, genres, formats, ratings, myRating] = await Promise.all([
    getMovie(id),
    getTranslations("movie"),
    getLocale(),
    getCachedGenres(),
    getCachedFormats(),
    getCachedAgeRatings(),
    getMyMovieRating(user.userId, id),
  ]);
  if (!movie) notFound();
  const en = locale === "en";
  const backHref = resolveUserBackHref(sp.back, "/showtimes");

  const genreById = new Map(genres.map((g) => [g.id, g]));
  const formatById = new Map(formats.map((f) => [f.id, f]));
  const genreNames = (movie.genreIds ?? []).map((gid) => genreById.get(gid.toString())).filter((g) => g !== undefined).map((g) => (en && g.nameEn ? g.nameEn : g.name));
  const formatNames = (movie.formatIds ?? []).map((fid) => formatById.get(fid.toString())?.name).filter(Boolean);
  const rating = ratings.find((r) => r.id === movie.ageRatingId?.toString());

  const facts: [string, string | undefined][] = [
    [t("synopsis"), movie.synopsis ?? undefined],
    [t("director"), movie.director ?? undefined],
    [t("cast"), movie.cast ?? undefined],
    [t("language"), movie.language ?? undefined],
  ];

  return (
    <ScopedIntlProvider namespaces={["movie", "showtimes"]}>
      <div className="flex flex-1 flex-col gap-section p-inset">
      <PageHeader title={movie.title} backHref={backHref} />

      <section className="flex flex-col gap-group">
        <div className="flex items-start gap-group">
          <div className="relative flex aspect-[2/3] w-thumb-poster-lg shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted sm:w-poster">
            {movie.posterUrl ? (
              <RemoteImage src={movie.posterUrl} alt={t("posterAlt", { title: movie.title })} fill sizes={`${PX.poster}px`} className="object-cover" preload />
            ) : (
              <Reel2Icon className="size-icon-lg text-muted-foreground" aria-hidden />
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-stack">
            <h2 className="type-heading">{movie.title}</h2>
            {movie.originalTitle ? <p className="type-secondary text-muted-foreground">{movie.originalTitle}</p> : null}
            <div className="flex flex-wrap gap-stack">
              <Badge variant={movie.status === "showing" ? "default" : "secondary"}>
                {t(`status.${movie.status}`)}
              </Badge>
              {rating ? <AgeRatingBadge rating={rating} /> : null}
              {myRating ? (
                <Badge variant="accent" className="tabular-nums">
                  <StarFilledIcon className="text-seat-favorite" aria-hidden />
                  {myRating.rating}/5
                </Badge>
              ) : null}
            </div>
            <p className="type-secondary tabular-nums">{t("duration", { minutes: movie.durationMin })}</p>
            <p className="type-secondary text-muted-foreground tabular-nums">{t("releaseOn", { date: formatDay(movie.releaseDate, locale) })}</p>
          </div>
        </div>

        {genreNames.length > 0 || formatNames.length > 0 ? (
          <div className="flex flex-wrap gap-stack">
            <span role="group" aria-label={t("genres")} className="contents">
              {genreNames.map((name) => (
                <Badge key={name} variant="secondary">
                  {name}
                </Badge>
              ))}
            </span>
            <span role="group" aria-label={t("formats")} className="contents">
              {formatNames.map((name) => (
                <Badge key={name} variant="outline">
                  {name}
                </Badge>
              ))}
            </span>
          </div>
        ) : null}

        {movie.trailer ? <TrailerPlayer videoId={movie.trailer.videoId} title={movie.title} /> : null}
      </section>

      <dl className="flex flex-col gap-item type-secondary">
        {facts
          .filter((fact): fact is [string, string] => Boolean(fact[1]))
          .map(([label, value]) => (
            <div key={label} className="flex flex-col gap-stack">
              <dt className="text-muted-foreground">{label}</dt>
              <dd>{label === t("synopsis") ? <CollapsibleText text={value} /> : <span className="type-body whitespace-pre-line">{value}</span>}</dd>
            </div>
          ))}
      </dl>

      <Suspense fallback={<LoadingState compact />}>
        <MovieShowtimesSection movieId={id} />
      </Suspense>
      </div>
    </ScopedIntlProvider>
  );
}

async function MovieShowtimesSection({ movieId }: { movieId: string }) {
  const [t, showtimes] = await Promise.all([getTranslations("movie"), searchShowtimes({ movieId, limit: 120 })]);
  if (showtimes.length === 0) {
    return (
      <section className="flex flex-col gap-item">
        <h2 className="type-heading">{t("showtimes")}</h2>
        <div className="flex flex-col items-center justify-center gap-item rounded-xl border bg-card p-inset-lg text-center">
          <p className="type-secondary text-muted-foreground">{t("noShowtimes")}</p>
          <Button asChild variant="outline" size="pill">
            <Link href="/showtimes">{t("browseShowtimes")}</Link>
          </Button>
        </div>
      </section>
    );
  }
  return (
    <section className="flex flex-col gap-item">
      <h2 className="type-heading">{t("showtimes")}</h2>
      <MovieShowtimes rows={showtimes} backHref={`/movies/${movieId}`} />
    </section>
  );
}
