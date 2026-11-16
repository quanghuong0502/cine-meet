import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center">
      <EmptyState
        mascot="bubu"
        title="Không tìm thấy trang"
        description="Trang bạn tìm không tồn tại hoặc đã được chuyển đi."
        action={
          <Button asChild className="h-12 rounded-full px-8 text-base">
            <Link href="/">Về trang chủ</Link>
          </Button>
        }
      />
    </main>
  );
}
