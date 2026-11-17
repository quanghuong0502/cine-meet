import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { MasterDataTabs } from "@/components/admin/master-data-tabs";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import { MASTER_DATA_SECTIONS, type MasterDataSectionKey } from "@/lib/master-data-sections";
import { SECTIONS } from "./_sections";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.masterData");
  return { title: t("title") };
}

/**
 * All master-data settings live on this one page: each type (brands, cinemas, genres...) is a tab,
 * chosen with `?tab=`, so the menus only need a single "Catalog" link.
 */
export default async function MasterDataPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string }>;
}) {
  const t = await getTranslations("admin.masterData");
  const { tab, q = "" } = await searchParams;
  const active = MASTER_DATA_SECTIONS.find((section) => section.key === tab) ?? MASTER_DATA_SECTIONS[0];
  if (!active) return null;
  const { List } = SECTIONS[active.key];
  const labels = Object.fromEntries(
    MASTER_DATA_SECTIONS.map(({ key }) => [key, t(`sections.${key}.title`)]),
  ) as Record<MasterDataSectionKey, string>;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4">
      <PageHeader title={t("title")} description={t("description")} />

      <MasterDataTabs label={t("tabsLabel")} labels={labels} activeKey={active.key} />

      {/* The list streams in by itself: the title and tabs above stay on screen while it loads. */}
      <Suspense key={active.key} fallback={<LoadingState compact />}>
        <List q={q} />
      </Suspense>
    </div>
  );
}
