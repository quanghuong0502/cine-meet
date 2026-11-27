import { getTranslations } from "next-intl/server";
import { ResourceManager } from "@/components/admin/resource-manager";
import type { ResourceField } from "@/components/admin/resource-types";
import { ROOM_3D_PRESET_IDS } from "@/lib/seat-layout/room-3d-appearance.defaults";
import { brandService } from "@/services/master-data/brand.service";
import type { SectionDefinition } from "../types";
import { getBrandLogoUploadTicket } from "@/actions/uploads";
import { removeBrand, saveBrand } from "./actions";

/** The "Brands" tab of the Catalog page, and its entry screen. */
export const brandsSection: SectionDefinition = {
  async List({ q }) {
    const [t, tc, t3d] = await Promise.all([
      getTranslations("admin.brands"),
      getTranslations("admin.common"),
      getTranslations("admin.room3dAppearance"),
    ]);
    const brands = await brandService.list({ q });
    return (
      <ResourceManager
        basePath="/admin/master-data/brands"
        query={q}
        labels={{ addButton: t("addButton"), emptyTitle: t("emptyTitle"), emptyDescription: t("emptyDescription") }}
        items={brands.map((brand) => {
          const meta: string[] = [];
          if (brand.room3dPreset) meta.push(t3d(`presets.${brand.room3dPreset}`));
          if (brand.active === false) meta.push(tc("inactiveBadge"));
          return {
            id: brand._id.toString(),
            title: brand.name,
            subtitle: brand.websiteUrl ? new URL(brand.websiteUrl).host : undefined,
            color: brand.color ?? undefined,
            imageUrl: brand.logoUrl ?? undefined,
            meta: meta.length > 0 ? meta : undefined,
          };
        })}
        removeAction={removeBrand}
      />
    );
  },

  async loadForm(id) {
    const [t, tc, t3d] = await Promise.all([
      getTranslations("admin.brands"),
      getTranslations("admin.common"),
      getTranslations("admin.room3dAppearance"),
    ]);
    const brand = id ? await brandService.getById(id) : null;
    if (id && !brand) return null;

    const fields: ResourceField[] = [
      { name: "name", kind: "text", label: t("fields.name.label"), required: true, maxLength: 60 },
      { name: "color", kind: "color", label: t("fields.color.label"), },
      { name: "logoUrl", kind: "image", label: t("fields.logoUrl.label"), uploadTicket: getBrandLogoUploadTicket },
      { name: "websiteUrl", kind: "url", label: t("fields.websiteUrl.label"), maxLength: 300 },
      { name: "appUrl", kind: "url", label: t("fields.appUrl.label"), maxLength: 300 },
      {
        name: "room3dPreset",
        kind: "select",
        label: t("fields.room3dPreset.label"),
        placeholder: t("fields.room3dPreset.defaultOption"),
        options: [
          { value: "none", label: t("fields.room3dPreset.defaultOption") },
          ...ROOM_3D_PRESET_IDS.map((presetId) => ({
            value: presetId,
            label: t3d(`presets.${presetId}`),
          })),
        ],
      },
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
        room3dPreset: brand?.room3dPreset ?? "none",
        active: brand && brand.active === false ? "" : "on",
      },
      itemName: brand?.name,
      saveAction: saveBrand,
      removeAction: removeBrand,
    };
  },
};
