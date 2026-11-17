"use client";

import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useLayoutEffect } from "react";
import { MasterDataTabs } from "@/components/admin/master-data-tabs";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import { RouteLoading } from "@/components/route-loading";
import { setHoldingBottomBar } from "@/lib/entry-loading-store";
import { MASTER_DATA_SECTIONS, sectionFromSlug, type MasterDataSectionKey } from "@/lib/master-data-sections";

/**
 * The wait while a master-data entry screen (add or edit) opens. It draws the Catalog page the person just tapped in (real title and
 * tabs, and the bottom bar stays) and only the content area turns into the loader, so nothing jumps; the entry screen replaces all of it.
 */
export function EntryLoading() {
  const t = useTranslations("admin.masterData");
  const { section } = useParams<{ section: string }>();
  const active = sectionFromSlug(section)?.key ?? MASTER_DATA_SECTIONS[0]?.key;

  useLayoutEffect(() => {
    setHoldingBottomBar(true);
    return () => setHoldingBottomBar(false);
  }, []);

  if (!active) return null;
  const labels = Object.fromEntries(MASTER_DATA_SECTIONS.map(({ key }) => [key, t(`sections.${key}.title`)])) as Record<MasterDataSectionKey, string>;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4" aria-busy="true">
      <PageHeader title={t("title")} description={t("description")} />
      <MasterDataTabs label={t("tabsLabel")} labels={labels} activeKey={active} />
      <RouteLoading inline={<LoadingState compact />} />
    </div>
  );
}
