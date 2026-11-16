"use client";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-dvh items-center justify-center">
      <EmptyState
        mascot="bubu-sleepy"
        title="Có gì đó trục trặc"
        description="Đã xảy ra lỗi ngoài ý muốn. Bạn thử tải lại nhé."
        action={
          <Button onClick={reset} className="h-12 rounded-full px-8 text-base">
            Thử lại
          </Button>
        }
      />
    </main>
  );
}
