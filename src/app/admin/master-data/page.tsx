import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = { title: "Danh mục" };

export default function AdminMasterDataPage() {
  return (
    <PlaceholderPage
      title="Danh mục"
      description="Thương hiệu, chi nhánh, thể loại, định dạng và bảng giá sẽ có ở Sprint 1."
    />
  );
}
