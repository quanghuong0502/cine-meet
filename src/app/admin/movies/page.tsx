import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = { title: "Phim & suất chiếu" };

export default function AdminMoviesPage() {
  return (
    <PlaceholderPage
      title="Phim & suất chiếu"
      description="Quản lý phim, trailer và suất chiếu sẽ có ở Sprint 3."
    />
  );
}
