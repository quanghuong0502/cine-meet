import { getTranslations } from "next-intl/server";
import { ResourceManager } from "@/components/admin/resource-manager";
import type { ResourceField } from "@/components/admin/resource-types";
import { brandService } from "@/services/master-data/brand.service";
import type { SectionDefinition } from "../types";
import { getBrandLogoUploadTicket } from "@/actions/uploads";
import { removeBrand, saveBrand } from "./actions";

/** The "Brands" tab of the Catalog page, and its entry screen. */
export const brandsSection: SectionDefinition = {
  async List({ q }) {
    const [t, tc] = await Promise.all([getTranslations("admin.brands"), getTranslations("admin.common")]);
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
          imageUrl: brand.logoUrl ?? undefined,
          meta: brand.active === false ? [tc("inactiveBadge")] : undefined,
        }))}
        removeAction={removeBrand}
      />
    );
  },

  async loadForm(id) {
    const [t, tc] = await Promise.all([getTranslations("admin.brands"), getTranslations("admin.common")]);
    const brand = id ? await brandService.getById(id) : null;
    if (id && !brand) return null;

    const fields: ResourceField[] = [
      { name: "name", kind: "text", label: t("fields.name.label"), required: true, maxLength: 60 },
      { name: "color", kind: "color", label: t("fields.color.label"), },
      { name: "logoUrl", kind: "image", label: t("fields.logoUrl.label"), uploadTicket: getBrandLogoUploadTicket },
      { name: "websiteUrl", kind: "url", label: t("fields.websiteUrl.label"), maxLength: 300 },
      { name: "appUrl", kind: "url", label: t("fields.appUrl.label"), maxLength: 300 },
      { name: "active", kind: "switch", label: tc("activeLabel") },
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
        active: brand && brand.active === false ? "" : "on",
      },
      itemName: brand?.name,
      saveAction: saveBrand,
      removeAction: removeBrand,
    };
  },
};
