import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { AppointmentDetail } from "@/components/appointment/appointment-detail";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/guards";
import { getCosts, getPlanData } from "@/services/appointment-plan.service";
import { getAppointment } from "@/services/appointment.service";
import { getFriendOverview, listGroups } from "@/services/friend.service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("appointments.detail");
  return { title: t("title") };
}

export default async function AppointmentPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const t = await getTranslations("appointments.detail");
  const view = await getAppointment(user.userId, id);
  if (!view) notFound();
  // Friends and groups are only needed for the creator's "invite more".
  const [overview, groups] = view.isCreator ? await Promise.all([getFriendOverview(user.userId), listGroups(user.userId)]) : [null, []];
  // Only what this step needs: the creator's planning data, or everyone's real costs once it is over.
  const [plan, costs] = await Promise.all([view.isCreator ? getPlanData(user.userId, id) : null, view.status === "COMPLETED" ? getCosts(id) : null]);
  return (
    <div className="flex w-full flex-col gap-section p-inset">
      <PageHeader title={t("title")} backHref="/appointments" />
      <AppointmentDetail
        view={view}
        friends={overview?.friends.map((f) => ({ id: f.id, name: f.name }))}
        plan={plan}
        costs={costs?.perUser}
        groups={groups.map((g) => ({ id: g.id, name: g.name, memberIds: g.members.map((m) => m.id) }))}
      />
    </div>
  );
}
