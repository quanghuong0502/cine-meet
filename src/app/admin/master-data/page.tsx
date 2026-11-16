import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { MASTER_DATA_SECTIONS } from "@/lib/master-data-sections";
import { cn } from "@/lib/utils";
import { SECTION_COMPONENTS } from "./_sections";

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
  const Section = SECTION_COMPONENTS[active.key];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4">
      <PageHeader title={t("title")} description={t("description")} />

      {/* Tabs scroll sideways inside their own strip when there are more than fit. */}
      <nav aria-label={t("tabsLabel")} className="-mx-4">
        <ul className="flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {MASTER_DATA_SECTIONS.map(({ key, icon: Icon }) => {
            const selected = key === active.key;
            return (
              <li key={key} className="shrink-0">
                <Link
                  href={`/admin/master-data?tab=${key}`}
                  aria-current={selected ? "page" : undefined}
                  className={cn(
                    "flex h-target items-center gap-2 rounded-full border px-4 text-sm font-medium",
                    selected
                      ? "border-transparent bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {t(`sections.${key}.title`)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <Section key={active.key} q={q} />
    </div>
  );
}
