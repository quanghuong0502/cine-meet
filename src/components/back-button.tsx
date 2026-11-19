import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface BackButtonProps {
  href: string;
  className?: string;
}

/**
 * The one back button of the app: a round arrow at the top left of an inner screen, in the same place everywhere.
 * An installed PWA has no browser Back button (docs: .claude/rules/mobile-ux.md), so it always points to a fixed parent screen.
 */
export function BackButton({ href, className }: BackButtonProps) {
  const t = useTranslations("nav");
  return (
    <Button asChild variant="ghost" size="icon" className={`-ml-stack shrink-0 rounded-full ${className ?? ""}`} aria-label={t("back")}>
      <Link href={href}>
        <ArrowLeft className="size-icon-lg" aria-hidden />
      </Link>
    </Button>
  );
}
