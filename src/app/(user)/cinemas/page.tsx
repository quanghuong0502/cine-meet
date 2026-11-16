import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = { title: "Rạp" };

export default function CinemasPage() {
  return (
    <PlaceholderPage
      title="Rạp"
      description="Danh sách rạp và sơ đồ phòng chiếu sẽ có ở Sprint 2–3."
    />
  );
}
