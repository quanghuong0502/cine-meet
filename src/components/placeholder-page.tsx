import { useTranslations } from "next-intl";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

interface PlaceholderPageProps {
  title: string;
  description: string;
  backHref?: string;
}

/** Temporary body for routes whose feature is built in a later sprint. */
export function PlaceholderPage({ title, description, backHref = "/" }: PlaceholderPageProps) {
  const t = useTranslations("states");
  return (
    <div className="flex flex-1 flex-col gap-section p-inset">
      <h1 className="type-title">{title}</h1>
      <EmptyState
        className="flex-1 justify-center"
        title={t("comingSoon")}
        description={description}
        mascot="bubu-sleepy"
        action={
          <Button asChild size="pill">
            <Link href={backHref}>{t("backHome")}</Link>
          </Button>
        }
      />
    </div>
  );
}
