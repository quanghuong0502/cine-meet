"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const COLLAPSE_THRESHOLD = 240;

/** Clamps long descriptions to four lines with a 44px toggle so primary content below (like showtimes) stays reachable. */
export function CollapsibleText({ text }: { text: string }) {
  const t = useTranslations("movie");
  const [expanded, setExpanded] = useState(false);
  const long = text.length > COLLAPSE_THRESHOLD;

  return (
    <div className="flex flex-col items-start gap-tight">
      <p className={cn("type-body whitespace-pre-line", long && !expanded && "line-clamp-4")}>{text}</p>
      {long ? (
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          className="-ml-inset-sm px-inset-sm"
        >
          {expanded ? t("showLess") : t("showMore")}
        </Button>
      ) : null}
    </div>
  );
}
