import { useTranslations } from "next-intl";
import { Mascot } from "@/components/mascot";

export default function Loading() {
  const t = useTranslations("states");
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[60dvh] flex-col items-center justify-center gap-3"
    >
      <Mascot pose="bubu-sleepy" size={112} decorative className="motion-safe:animate-pulse" />
      <p className="text-sm text-muted-foreground">{t("loading")}</p>
    </div>
  );
}
