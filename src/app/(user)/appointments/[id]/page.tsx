import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { AppointmentDetail } from "@/components/appointment/appointment-detail";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/guards";
import { getCosts, getPlanData } from "@/services/appointment-plan.service";
import { getAppointment } from "@/services/appointment.service";
import { getFriendOverview, listGroups } from "@/services/friend.service";
import { getMyMovieRating, getMySeatRatings } from "@/services/rating.service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("appointments.detail");
  return { title: t("title") };
}

export default async function AppointmentPage({ params }: { params: Promise<{ id: string }> }) {
  const [user, { id }, t] = await Promise.all([requireUser(), params, getTranslations("appointments.detail")]);
  const view = await getAppointment(user.userId, id);
  if (!view) notFound();
  // Fetch all stage-specific data in ONE parallel wave (and skip queries unneeded for the current lifecycle stage).
  const needsFriends = view.isCreator && (view.status === "DRAFT" || view.status === "INVITING");
  const needsPlan = view.isCreator && view.status === "PLANNING";
  const isCompleted = view.status === "COMPLETED";
  const [overview, groups, plan, costs, movieRating, seatRatings] = await Promise.all([
    needsFriends ? getFriendOverview(user.userId) : Promise.resolve(null),
    needsFriends ? listGroups(user.userId) : Promise.resolve([]),
    needsPlan ? getPlanData(user.userId, id) : Promise.resolve(null),
    isCompleted ? getCosts(id) : Promise.resolve(null),
    isCompleted ? getMyMovieRating(user.userId, view.movie.id) : Promise.resolve(null),
    isCompleted ? getMySeatRatings(user.userId, id) : Promise.resolve({}),
  ]);
  return (
    <div className="flex w-full flex-col gap-section p-inset">
      <PageHeader title={t("title")} backHref="/appointments" />
      <AppointmentDetail
        view={view}
        friends={overview?.friends.map((f) => ({ id: f.id, name: f.name }))}
        plan={plan}
        costs={costs?.perUser}
        groups={groups.map((g) => ({ id: g.id, name: g.name, memberIds: g.members.map((m) => m.id) }))}
        initialMovieRating={movieRating?.rating ?? 0}
        initialSeatRatings={seatRatings}
      />
    </div>
  );
}
