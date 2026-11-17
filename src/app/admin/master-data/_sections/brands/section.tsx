import { getTranslations } from "next-intl/server";
import { ResourceManager } from "@/components/admin/resource-manager";
import type { ResourceField } from "@/components/admin/resource-types";
import { brandService } from "@/services/master-data/brand.service";
import type { SectionDefinition } from "../types";
import { removeBrand, saveBrand } from "./actions";

/** The "Brands" tab of the Catalog page, and its entry screen. */
export const brandsSection: SectionDefinition = {
  async List({ q }) {
    const t = await getTranslations("admin.brands");
    const brands = await brandService.list({ q });
    return (
      <ResourceManager
        basePath="/admin/master-data/brands"
        query={q}
        labels={{ addButton: t("addButton"), emptyTitle: t("emptyTitle"), emptyDescription: t("emptyDescription") }}
        items={brands.map((brand) => ({
          id: brand._id.toString(),
          title: brand.name,
          subtitle: brand.websiteUrl ? new URL(brand.websiteUrl).host : undefined,
          color: brand.color ?? undefined,
        }))}
        removeAction={removeBrand}
      />
    );
  },

  async loadForm(id) {
    const t = await getTranslations("admin.brands");
    const brand = id ? await brandService.getById(id) : null;
    if (id && !brand) return null;

    const fields: ResourceField[] = [
      { name: "name", kind: "text", label: t("fields.name.label"), required: true, maxLength: 60 },
      { name: "color", kind: "color", label: t("fields.color.label"), hint: t("fields.color.hint") },
      { name: "logoUrl", kind: "url", label: t("fields.logoUrl.label"), hint: t("fields.logoUrl.hint"), maxLength: 300 },
      { name: "websiteUrl", kind: "url", label: t("fields.websiteUrl.label"), maxLength: 300 },
      { name: "appUrl", kind: "url", label: t("fields.appUrl.label"), hint: t("fields.appUrl.hint"), maxLength: 300 },
    ];

    return {
      title: brand ? t("editTitle") : t("createTitle"),
      fields,
      values: {
        name: brand?.name ?? "",
        color: brand?.color ?? "",
        logoUrl: brand?.logoUrl ?? "",
        websiteUrl: brand?.websiteUrl ?? "",
        appUrl: brand?.appUrl ?? "",
      },
      itemName: brand?.name,
      saveAction: saveBrand,
      removeAction: removeBrand,
    };
  },
};
