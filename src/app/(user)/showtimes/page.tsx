import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = { title: "Lịch chiếu" };

export default function ShowtimesPage() {
  return (
    <PlaceholderPage
      title="Lịch chiếu"
      description="Danh sách suất chiếu và trailer phim sẽ có ở Sprint 3."
    />
  );
}
