import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/empty-state";

interface PlaceholderPageProps {
  title: string;
  description: string;
}

/** Temporary body for routes whose feature is built in a later sprint. */
export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  const t = useTranslations("states");
  return (
    <div className="flex flex-col gap-2 p-4">
      <h1 className="type-title">{title}</h1>
      <EmptyState title={t("comingSoon")} description={description} mascot="bubu-sleepy" />
    </div>
  );
}
