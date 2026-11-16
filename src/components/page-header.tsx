import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface PageHeaderProps {
  title: string;
  /** Where the back button goes. An installed PWA has no browser Back button, so every inner screen (not a tab) sets this. */
  backHref?: string;
  description?: string;
}

export function PageHeader({ title, backHref, description }: PageHeaderProps) {
  const t = useTranslations("nav");
  return (
    <header className="flex items-start gap-2">
      {backHref ? (
        <Button asChild variant="ghost" size="icon" className="-ml-2 size-target shrink-0 rounded-full" aria-label={t("back")}>
          <Link href={backHref}>
            <ArrowLeft aria-hidden />
          </Link>
        </Button>
      ) : null}
      <div className="flex min-w-0 flex-col gap-0.5 pt-1.5">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
    </header>
  );
}
