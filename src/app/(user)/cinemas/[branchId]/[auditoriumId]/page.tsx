import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { RoomSeatView } from "@/components/seat-map/room-seat-view";
import { requireUser } from "@/lib/auth/guards";
import { getRoomView } from "@/services/cinema.service";
import { getSeatMarks } from "@/services/seat-mark.service";
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
  // Only this person's marks: the id comes from the session.
  const marks = await getSeatMarks(user.userId, auditoriumId, view.layoutId);

  return (
    <div className="flex flex-1 flex-col gap-section p-inset">
      <PageHeader backHref={`/cinemas/${branchId}`} />
      <h1 className="sr-only">{view.auditorium.name}</h1>
      <RoomSeatView view={view} marks={marks} saveAction={saveSeatMarkAction} removeAction={removeSeatMarkAction} />
    </div>
  );
}
