"use client";

import { CloseIcon, RoundedMagnifierIcon } from "@solar-icons/react/line-duotone";
import { useTranslations } from "next-intl";
import { useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase();
}

export interface CinemaBranchCardItem {
  id: string;
  searchText: string;
  card: ReactNode;
}

interface Props {
  items: CinemaBranchCardItem[];
  emptyMascot?: ReactNode;
}

/**
 * Lightweight client search wrapper over server-rendered cinema branch cards.
 * Keeps card markup (thumbnails, badges, icons) on the server while giving instant Vietnamese accent-insensitive filtering when >= 4 branches exist.
 */
export function CinemaBranchList({ items, emptyMascot }: Props) {
  const t = useTranslations("cinemas");
  const [query, setQuery] = useState("");
  const needle = normalizeText(query.trim());

  const shown = useMemo(() => {
    if (!needle) return items;
    return items.filter((item) => normalizeText(item.searchText).includes(needle));
  }, [items, needle]);

  const showSearch = items.length >= 4 || query.length > 0;

  return (
    <div className="flex flex-1 flex-col gap-item">
      {showSearch ? (
        <div className="relative">
          <RoundedMagnifierIcon
            className="pointer-events-none absolute top-1/2 left-inset-sm size-icon-sm -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchPlaceholder")}
            enterKeyHint="search"
            className="h-control rounded-xl bg-card pr-control pl-control type-body"
          />
          {query ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setQuery("")}
              aria-label={t("filters.clear")}
              className="absolute top-1/2 right-hair size-target -translate-y-1/2 text-muted-foreground"
            >
              <CloseIcon aria-hidden />
            </Button>
          ) : null}
        </div>
      ) : null}

      {shown.length === 0 ? (
        <div className="flex w-full flex-1 flex-col items-center justify-center gap-item px-inset-lg py-inset-xl text-center">
          {emptyMascot}
          <h2 className="type-heading">{t("filters.emptyTitle")}</h2>
          <p className="max-w-hint type-secondary text-muted-foreground">{t("filters.emptyDescription")}</p>
          <div className="mt-stack">
            <Button type="button" size="pill" onClick={() => setQuery("")}>
              {t("filters.clear")}
            </Button>
          </div>
        </div>
      ) : (
        <ul className="flex flex-col gap-item">
          {shown.map((item) => (
            <li key={item.id} className="list-card-cv">
              {item.card}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
