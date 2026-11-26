import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export default async function NotFound() {
  const t = await getTranslations("states.notFound");
  return (
    <main className="flex min-h-dvh items-center justify-center">
      <EmptyState
        mascot="bubu-sleepy"
        title={t("title")}
        description={t("description")}
        action={
          <Button asChild size="pill">
            <Link href="/">{t("action")}</Link>
          </Button>
        }
      />
    </main>
  );
}
