import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { RoomReportButton } from "@/components/room-report-button";
import { RoomReviewForm } from "@/components/room-review-form";
import { ScopedIntlProvider } from "@/components/scoped-intl-provider";
import { RoomSeatView } from "@/components/seat-map/room-seat-view";
import { requireUser } from "@/lib/auth/guards";
import { getRoomView } from "@/services/cinema.service";
import { getMyAuditoriumReview, getMySeatRatingsForRoom } from "@/services/rating.service";
import { getSeatMarks } from "@/services/seat-mark.service";
import { listViewingSessionsForRoom, sittingHistoryOf } from "@/services/viewing-history.service";
import { removeSeatMarkAction, saveSeatMarkAction } from "../../actions";

type Props = { params: Promise<{ branchId: string; auditoriumId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { branchId, auditoriumId } = await params;
  const view = await getRoomView(branchId, auditoriumId);
  return { title: view?.auditorium.name };
}

export default async function RoomPage({ params }: Props) {
  const [user, { branchId, auditoriumId }] = await Promise.all([requireUser(), params]);
  // Start room-scoped history and ratings in parallel with `getRoomView` (already deduplicated with `generateMetadata`).
  const [view, sessions, seatRatings] = await Promise.all([
    getRoomView(branchId, auditoriumId),
    listViewingSessionsForRoom(user.userId, auditoriumId),
    getMySeatRatingsForRoom(user.userId, auditoriumId),
  ]);
  if (!view) notFound();
  const marks = await getSeatMarks(user.userId, auditoriumId, view.layoutId);
  const sitting = sittingHistoryOf(sessions, auditoriumId, seatRatings);

  return (
    <ScopedIntlProvider namespaces={["cinemas.room", "seatMap", "admin.common"]}>
      <div className="flex flex-1 flex-col gap-section p-inset">
        <PageHeader title={view.auditorium.name} backHref={`/cinemas/${branchId}`}>
          <RoomReportButton auditoriumId={auditoriumId} />
        </PageHeader>
        <p className="-mt-item type-secondary text-muted-foreground">{view.branch.name}</p>
        <RoomSeatView view={view} marks={marks} sitting={sitting} saveAction={saveSeatMarkAction} removeAction={removeSeatMarkAction} />
        <Suspense fallback={null}>
          <RoomReviewSection userId={user.userId} auditoriumId={auditoriumId} />
        </Suspense>
      </div>
    </ScopedIntlProvider>
  );
}

async function RoomReviewSection({ userId, auditoriumId }: { userId: string; auditoriumId: string }) {
  const review = await getMyAuditoriumReview(userId, auditoriumId);
  return <RoomReviewForm auditoriumId={auditoriumId} initial={review} />;
}
