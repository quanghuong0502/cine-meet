import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { MASTER_DATA_SECTIONS } from "@/lib/master-data-sections";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.masterData");
  return { title: t("title") };
}

export default async function MasterDataPage() {
  const t = await getTranslations("admin.masterData");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4">
      <PageHeader title={t("title")} description={t("description")} />
      <ul className="grid gap-3 md:grid-cols-2">
        {MASTER_DATA_SECTIONS.map(({ key, href, icon: Icon }) => (
          <li key={key}>
            <Link
              href={href}
              className="flex min-h-16 items-center gap-3 rounded-xl border bg-card p-3 transition-colors active:bg-accent"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-base font-semibold">{t(`sections.${key}.title`)}</span>
                <span className="text-sm text-muted-foreground">{t(`sections.${key}.description`)}</span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
