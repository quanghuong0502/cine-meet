import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = { title: "Tổng quan quản trị" };

export default function AdminDashboardPage() {
  return (
    <PlaceholderPage
      title="Tổng quan quản trị"
      description="Số liệu tổng quan hệ thống sẽ được bổ sung sau."
    />
  );
}
