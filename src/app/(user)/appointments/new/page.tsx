import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { NewAppointmentForm } from "@/components/appointment/new-appointment-form";
import type { ShowtimeChoice } from "@/components/appointment/showtime-picker";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/guards";
import { getFriendOverview, listGroups } from "@/services/friend.service";
import { listFilterMovies } from "@/services/movie.service";
import { listMovieIdsWithShowtimes, searchShowtimes } from "@/services/showtime.service";
import { Showtime } from "@/models/showtime";
import { connectToDatabase } from "@/lib/db";
import { isValidObjectId } from "mongoose";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("appointments.new");
  return { title: t("title") };
}

type SearchParams = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** `?showtimeId=` (the "plan this showtime" button) fills the movie and the first time; `?movieId=` only the movie. */
export default async function NewAppointmentPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser();
  const t = await getTranslations("appointments.new");
  const params = await searchParams;

  let movieId = first(params.movieId);
  let showtimeId = first(params.showtimeId);
  if (showtimeId) {
    await connectToDatabase();
    const showtime = isValidObjectId(showtimeId) ? await Showtime.findById(showtimeId, "movieId").lean() : null;
    if (showtime) movieId = showtime.movieId.toString();
    else showtimeId = undefined;
  }

  const [allMovies, withShowtimes, overview, groups, rows] = await Promise.all([
    listFilterMovies(),
    listMovieIdsWithShowtimes(),
    getFriendOverview(user.userId),
    listGroups(user.userId),
    movieId && isValidObjectId(movieId) ? searchShowtimes({ movieId }) : Promise.resolve([]),
  ]);
  // Only movies that can actually be watched: one with no showtime to come would be a dead end in the list.
  const movies = allMovies.filter((m) => withShowtimes.has(m._id.toString()));
  if (movieId && !movies.some((m) => m._id.toString() === movieId)) movieId = undefined;

  const showtimes: ShowtimeChoice[] = rows.map((row) => ({
    id: row.id,
    startAt: row.startAt,
    branchId: row.branch.id,
    branchName: [row.branch.brandName, row.branch.name].filter(Boolean).join(" · "),
    label: [row.auditorium.name, row.format.name].filter(Boolean).join(" · "),
  }));
  if (showtimeId && !showtimes.some((s) => s.id === showtimeId)) showtimeId = undefined;

  return (
    <div className="flex w-full flex-col gap-section p-inset">
      <PageHeader title={t("title")} backHref="/appointments" hideTitle />
      <NewAppointmentForm
        movies={movies.map((m) => ({ id: m._id.toString(), title: m.title }))}
        movieId={movieId}
        showtimes={showtimes}
        initialShowtimeId={showtimeId}
        friends={overview.friends.map((f) => ({ id: f.id, name: f.name }))}
        groups={groups.map((g) => ({ id: g.id, name: g.name, memberIds: g.members.map((m) => m.id) }))}
      />
    </div>
  );
}
