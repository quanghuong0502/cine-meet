"use client";

import { useTranslations } from "next-intl";
import { useParams, useSearchParams } from "next/navigation";
import { useLayoutEffect } from "react";
import { MasterDataTabs } from "@/components/admin/master-data-tabs";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import { RouteLoading } from "@/components/route-loading";
import { setHoldingBottomBar } from "@/lib/entry-loading-store";
import { MASTER_DATA_SECTIONS, sectionFromSlug, type MasterDataSectionKey } from "@/lib/master-data-sections";

/**
 * The wait on the Catalog page: while an entry screen (add or edit) opens, and while the Catalog list itself loads. It draws the
 * Catalog page's frame with its real title and tabs and only the content area turns into the loader, so nothing jumps.
 * Which tab is selected comes from the entry screen's path (`[section]`) or, on the list, from `?tab=`.
 * `holdBar` keeps the bottom bar up while an entry screen loads (its path would hide it); on the list the bar shows by itself.
 */
export function EntryLoading({ holdBar = true }: { holdBar?: boolean }) {
  const t = useTranslations("admin.masterData");
  const { section } = useParams<{ section?: string }>();
  const tab = useSearchParams().get("tab");
  const active =
    (section ? sectionFromSlug(section)?.key : MASTER_DATA_SECTIONS.find((item) => item.key === tab)?.key) ?? MASTER_DATA_SECTIONS[0]?.key;

  useLayoutEffect(() => {
    if (!holdBar) return;
    setHoldingBottomBar(true);
    return () => setHoldingBottomBar(false);
  }, [holdBar]);

  if (!active) return null;
  const labels = Object.fromEntries(MASTER_DATA_SECTIONS.map(({ key }) => [key, t(`sections.${key}.title`)])) as Record<MasterDataSectionKey, string>;

  return (
    <div className="mx-auto flex w-full max-w-page flex-1 flex-col gap-section p-inset" aria-busy="true">
      <PageHeader title={t("title")} description={t("description")} />
      <MasterDataTabs label={t("tabsLabel")} labels={labels} activeKey={active} />
      <RouteLoading inline={<LoadingState compact />} />
    </div>
  );
}
