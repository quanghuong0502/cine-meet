import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { RoomReportButton } from "@/components/room-report-button";
import { RoomReviewForm } from "@/components/room-review-form";
import { SittingHistorySummary } from "@/components/sitting-history-list";
import { RoomSeatView } from "@/components/seat-map/room-seat-view";
import { requireUser } from "@/lib/auth/guards";
import { getRoomView } from "@/services/cinema.service";
import { getMyAuditoriumReview, getMySeatRatingsForRoom } from "@/services/rating.service";
import { getSeatMarks } from "@/services/seat-mark.service";
import { listViewingSessions, sittingHistoryOf } from "@/services/viewing-history.service";
import { removeSeatMarkAction, saveSeatMarkAction } from "../../actions";

type Props = { params: Promise<{ branchId: string; auditoriumId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { branchId, auditoriumId } = await params;
  const view = await getRoomView(branchId, auditoriumId);
  return { title: view?.auditorium.name };
}

export default async function RoomPage({ params }: Props) {
  const user = await requireUser();
  const { branchId, auditoriumId } = await params;
  const view = await getRoomView(branchId, auditoriumId);
  if (!view) notFound();
  // Only this person's marks, review and history: every id comes from the session.
  const [marks, review, sessions, seatRatings] = await Promise.all([
    getSeatMarks(user.userId, auditoriumId, view.layoutId),
    getMyAuditoriumReview(user.userId, auditoriumId),
    listViewingSessions(user.userId),
    getMySeatRatingsForRoom(user.userId, auditoriumId),
  ]);
  const sitting = sittingHistoryOf(sessions, auditoriumId, seatRatings);

  return (
    <div className="flex flex-1 flex-col gap-section p-inset">
      <PageHeader backHref={`/cinemas/${branchId}`}>
        <RoomReportButton auditoriumId={auditoriumId} />
      </PageHeader>
      <h1 className="sr-only">{view.auditorium.name}</h1>
      <SittingHistorySummary rows={sitting} />
      <RoomSeatView view={view} marks={marks} saveAction={saveSeatMarkAction} removeAction={removeSeatMarkAction} />
      <RoomReviewForm auditoriumId={auditoriumId} initial={review} />
    </div>
  );
}
