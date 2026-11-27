import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AppointmentDetail } from "@/components/appointment/appointment-detail";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import { ScopedIntlProvider } from "@/components/scoped-intl-provider";
import { requireUser } from "@/lib/auth/guards";
import { resolveUserBackHref } from "@/lib/user-back-href";
import { getCosts, getPlanData } from "@/services/appointment-plan.service";
import { getAppointment } from "@/services/appointment.service";
import { getFriendOverview, listGroups } from "@/services/friend.service";
import { getMyMovieRating, getMySeatRatings } from "@/services/rating.service";
import { getSystemSettings } from "@/services/settings.service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("appointments.detail");
  return { title: t("title") };
}

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string | string[] }>;
};

export default async function AppointmentPage({ params, searchParams }: Props) {
  const [user, { id }, sp, t] = await Promise.all([requireUser(), params, searchParams, getTranslations("appointments.detail")]);
  const backHref = resolveUserBackHref(sp.back, "/appointments");
  return (
    <ScopedIntlProvider namespaces={["appointments", "showtimes", "seatMap", "cinemas.room", "dateTimeField", "states.error"]}>
      <div className="flex w-full flex-col gap-section p-inset">
        <PageHeader title={t("title")} backHref={backHref} />
        <Suspense fallback={<LoadingState compact />}>
          <AppointmentBody userId={user.userId} id={id} />
        </Suspense>
      </div>
    </ScopedIntlProvider>
  );
}

async function AppointmentBody({ userId, id }: { userId: string; id: string }) {
  const view = await getAppointment(userId, id);
  if (!view) notFound();
  // Fetch all stage-specific data in ONE parallel wave (and skip queries unneeded for the current lifecycle stage).
  const needsFriends = view.isCreator && (view.status === "DRAFT" || view.status === "INVITING");
  const needsPollMeta = view.status === "INVITING";
  const needsPlan = view.isCreator && view.status === "PLANNING";
  const isCompleted = view.status === "COMPLETED";
  const canSeeCosts = isCompleted && (view.isCreator || view.myStatus === "accepted");
  const [overview, groups, plan, costs, movieRating, seatRatings, settings] = await Promise.all([
    needsFriends ? getFriendOverview(userId) : Promise.resolve(null),
    needsFriends ? listGroups(userId) : Promise.resolve([]),
    needsPlan ? getPlanData(userId, id) : Promise.resolve(null),
    canSeeCosts ? getCosts(id) : Promise.resolve(null),
    isCompleted ? getMyMovieRating(userId, view.movie.id) : Promise.resolve(null),
    isCompleted ? getMySeatRatings(userId, id) : Promise.resolve({}),
    needsPollMeta ? getSystemSettings() : Promise.resolve(null),
  ]);
  return (
    <AppointmentDetail
      view={view}
      friends={overview?.friends.map((f) => ({ id: f.id, name: f.name }))}
      plan={plan}
      costs={costs?.perUser}
      groups={groups.map((g) => ({ id: g.id, name: g.name, memberIds: g.members.map((m) => m.id) }))}
      initialMovieRating={movieRating?.rating ?? 0}
      initialSeatRatings={seatRatings}
      deadlineLeadMinutes={settings?.responseDeadlineMinutes}
      timeSlots={settings?.timeSlots}
    />
  );
}
