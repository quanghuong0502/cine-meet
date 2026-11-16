import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = { title: "Người dùng" };

export default function AdminUsersPage() {
  return (
    <PlaceholderPage
      title="Người dùng"
      description="Danh sách, khóa/mở khóa và đổi vai trò người dùng sẽ có ở Sprint 1."
    />
  );
}
