import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Suspense } from "react";
import { NewAppointmentForm } from "@/components/appointment/new-appointment-form";
import { EmptyState } from "@/components/empty-state";
import { LoadingState } from "@/components/loading-state";
import { toShowtimeChoice } from "@/lib/appointment/showtime-choice";
import { PageHeader } from "@/components/page-header";
import { ScopedIntlProvider } from "@/components/scoped-intl-provider";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/guards";
import { resolveUserBackHref } from "@/lib/user-back-href";
import { getSystemSettings } from "@/services/settings.service";
import { getFriendOverview, listGroups } from "@/services/friend.service";
import { listFilterMovies } from "@/services/movie.service";
import { getShowtimeById, listMovieIdsWithShowtimes } from "@/services/showtime.service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("appointments.new");
  return { title: t("title") };
}

type SearchParams = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** `?showtimeId=` (the "plan this showtime" button) fills the movie and the first time; `?movieId=` only the movie. */
export default async function NewAppointmentPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [user, t, params] = await Promise.all([requireUser(), getTranslations("appointments.new"), searchParams]);
  const initialMovieId = first(params.movieId);
  const showtimeId = first(params.showtimeId);
  const backHref = resolveUserBackHref(params.back, "/appointments");

  return (
    <ScopedIntlProvider namespaces={["appointments.new", "appointments.networkError", "appointments.errors", "showtimes", "dateTimeField"]}>
      <div className="flex w-full flex-1 flex-col gap-section p-inset">
        <PageHeader title={t("title")} backHref={backHref} />
        <Suspense fallback={<LoadingState compact />}>
          <NewAppointmentBody userId={user.userId} initialMovieId={initialMovieId} showtimeId={showtimeId} />
        </Suspense>
      </div>
    </ScopedIntlProvider>
  );
}

async function NewAppointmentBody({
  userId,
  initialMovieId,
  showtimeId,
}: {
  userId: string;
  initialMovieId?: string;
  showtimeId?: string;
}) {
  let movieId = initialMovieId;
  const [t, allMovies, withShowtimes, overview, groups, initialShowtime, settings] = await Promise.all([
    getTranslations("appointments.new"),
    listFilterMovies(),
    listMovieIdsWithShowtimes(),
    getFriendOverview(userId),
    listGroups(userId),
    showtimeId ? getShowtimeById(showtimeId) : Promise.resolve(null),
    getSystemSettings(),
  ]);
  if (initialShowtime) movieId = initialShowtime.movie.id;
  // Only movies that can actually be watched: one with no showtime to come would be a dead end in the list.
  const movies = allMovies.filter((m) => withShowtimes.has(m._id.toString()));
  if (movieId && !movies.some((m) => m._id.toString() === movieId)) movieId = undefined;

  if (movies.length === 0) {
    return (
      <EmptyState
        className="flex-1 justify-center"
        mascot="bubu-sleepy"
        title={t("noMoviesTitle")}
        description={t("noMoviesDescription")}
        action={
          <Button asChild size="pill">
            <Link href="/showtimes">{t("browseShowtimes")}</Link>
          </Button>
        }
      />
    );
  }

  return (
    <NewAppointmentForm
      movies={movies.map((m) => ({ id: m._id.toString(), title: m.title }))}
      movieId={movieId}
      initialShowtime={initialShowtime ? toShowtimeChoice(initialShowtime) : undefined}
      slots={settings.timeSlots}
      deadlineLeadMinutes={settings.responseDeadlineMinutes}
      friends={overview.friends.map((f) => ({ id: f.id, name: f.name }))}
      groups={groups.map((g) => ({ id: g.id, name: g.name, memberIds: g.members.map((m) => m.id) }))}
    />
  );
}
