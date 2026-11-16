import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = { title: "Phòng chiếu" };

export default function AdminAuditoriumsPage() {
  return (
    <PlaceholderPage
      title="Phòng chiếu"
      description="Editor phòng chiếu và sơ đồ ghế sẽ có ở Sprint 2."
    />
  );
}
