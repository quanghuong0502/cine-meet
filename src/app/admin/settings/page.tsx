import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = { title: "Cài đặt" };

export default function AdminSettingsPage() {
  return (
    <PlaceholderPage
      title="Cài đặt"
      description="Cài đặt hệ thống, AI và template thông báo sẽ có ở Sprint 1 và 5."
    />
  );
}
