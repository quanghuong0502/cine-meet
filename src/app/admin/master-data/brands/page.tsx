import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/page-header";
import { ResourceManager, type ResourceField } from "@/components/admin/resource-manager";
import { brandService } from "@/services/master-data/brand.service";
import { removeBrand, saveBrand } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.brands");
  return { title: t("title") };
}

export default async function BrandsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const t = await getTranslations("admin.brands");
  const { q = "" } = await searchParams;
  const brands = await brandService.list({ q });

  const fields: ResourceField[] = [
    { name: "name", kind: "text", label: t("fields.name.label"), required: true, maxLength: 60 },
    { name: "color", kind: "color", label: t("fields.color.label"), hint: t("fields.color.hint") },
    { name: "logoUrl", kind: "url", label: t("fields.logoUrl.label"), hint: t("fields.logoUrl.hint"), maxLength: 300 },
    { name: "websiteUrl", kind: "url", label: t("fields.websiteUrl.label"), maxLength: 300 },
    { name: "appUrl", kind: "url", label: t("fields.appUrl.label"), hint: t("fields.appUrl.hint"), maxLength: 300 },
  ];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4">
      <PageHeader title={t("title")} backHref="/admin/master-data" />
      <ResourceManager
        query={q}
        fields={fields}
        labels={{
          addButton: t("addButton"),
          createTitle: t("createTitle"),
          editTitle: t("editTitle"),
          emptyTitle: t("emptyTitle"),
          emptyDescription: t("emptyDescription"),
        }}
        items={brands.map((brand) => ({
          id: brand._id.toString(),
          title: brand.name,
          subtitle: brand.websiteUrl ? new URL(brand.websiteUrl).host : undefined,
          color: brand.color ?? undefined,
          values: {
            name: brand.name,
            color: brand.color ?? "",
            logoUrl: brand.logoUrl ?? "",
            websiteUrl: brand.websiteUrl ?? "",
            appUrl: brand.appUrl ?? "",
          },
        }))}
        saveAction={saveBrand}
        removeAction={removeBrand}
      />
    </div>
  );
}
