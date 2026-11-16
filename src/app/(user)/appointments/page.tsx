import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = { title: "Lịch hẹn" };

export default function AppointmentsPage() {
  return (
    <PlaceholderPage
      title="Lịch hẹn"
      description="Mời bạn bè, chốt người tham gia và xếp ghế sẽ có ở Sprint 4–5."
    />
  );
}
