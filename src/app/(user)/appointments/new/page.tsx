import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { NewAppointmentForm, type ShowtimeChoice } from "@/components/appointment/new-appointment-form";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/guards";
import { getFriendOverview, listGroups } from "@/services/friend.service";
import { listFilterMovies } from "@/services/movie.service";
import { searchShowtimes } from "@/services/showtime.service";
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

  const [movies, overview, groups, rows] = await Promise.all([
    listFilterMovies(),
    getFriendOverview(user.userId),
    listGroups(user.userId),
    movieId && isValidObjectId(movieId) ? searchShowtimes({ movieId }) : Promise.resolve([]),
  ]);
  if (movieId && !movies.some((m) => m._id.toString() === movieId)) movieId = undefined;

  const showtimes: ShowtimeChoice[] = rows.slice(0, 60).map((row) => ({
    id: row.id,
    startAt: row.startAt,
    label: [row.branch.brandName, row.branch.name, row.auditorium.name, row.format.name].filter(Boolean).join(" · "),
  }));
  // A showtime that is not in the first page of the list is still shown when it is the one the person came from.
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
