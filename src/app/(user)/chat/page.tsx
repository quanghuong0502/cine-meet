import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = { title: "Chat" };

export default function ChatPage() {
  return (
    <PlaceholderPage
      title="Chat"
      description="Trợ lý AI hỗ trợ chọn ghế và tra cứu sẽ có ở Sprint 7."
    />
  );
}
