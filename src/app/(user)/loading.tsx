import { Mascot } from "@/components/mascot";

export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[60dvh] flex-col items-center justify-center gap-3"
    >
      <Mascot name="bubu" size={112} decorative className="motion-safe:animate-pulse" />
      <p className="text-sm text-muted-foreground">Đang tải...</p>
    </div>
  );
}
