import { fnbCategoryService } from "@/services/master-data/fnb-category.service";
import { fnbItemService } from "@/services/master-data/fnb-item.service";
import { createSection, formatValidity, formatVnd } from "../create-section";
import { removeFnbItem, saveFnbItem } from "./actions";

export const fnbItemsSection = createSection({
  key: "fnbItems",
  service: fnbItemService,
  saveAction: saveFnbItem,
  removeAction: removeFnbItem,
  needsBrand: true,
  // The categories as a pick-list (switched-off ones are only kept for a record that already uses one) and as names for the cards.
  loadExtra: async ({ locale }) => {
    const categories = await fnbCategoryService.list({});
    const label = (c: (typeof categories)[number]) => (locale === "en" && c.nameEn ? c.nameEn : c.name);
    return {
      categories: categories.map((c) => ({ value: c._id.toString(), label: label(c), active: c.active !== false })),
      categoryNames: new Map(categories.map((c) => [c._id.toString(), label(c)])),
    };
  },
  name: (item) => item.name,
  item: (item, context) => ({
    title: item.size ? `${item.name} (${item.size})` : item.name,
    subtitle: [context.brandNames.get(item.brandId.toString()), item.categoryId ? context.categoryNames.get(item.categoryId.toString()) : undefined, formatVnd(item.price, context.locale)].filter(Boolean).join(" · "),
    meta: formatValidity(item.validFrom, item.validTo, context) ? [formatValidity(item.validFrom, item.validTo, context) as string] : undefined,
  }),
  values: (item) => ({
    brandId: item.brandId.toString(),
    categoryId: item.categoryId?.toString() ?? "",
    name: item.name,
    nameEn: item.nameEn ?? "",
    size: item.size ?? "",
    price: item.price.toString(),
    validFrom: item.validFrom ?? "",
    validTo: item.validTo ?? "",
  }),
  fields: ({ t, brandOptions, categories }) => [
    { name: "brandId", kind: "select", label: t("fields.brandId.label"), required: true, options: brandOptions, placeholder: t("fields.brandId.placeholder") },
    { name: "categoryId", kind: "select", label: t("fields.categoryId.label"), options: categories.map(({ value, label }) => ({ value, label })), placeholder: t("fields.categoryId.placeholder") },
    { name: "name", kind: "text", label: t("fields.name.label"), required: true, maxLength: 80 },
    { name: "nameEn", kind: "text", label: t("fields.nameEn.label"), maxLength: 80 },
    { name: "size", kind: "text", label: t("fields.size.label"), placeholder: t("fields.size.placeholder"), maxLength: 30 },
    { name: "price", kind: "number", label: t("fields.price.label"), placeholder: t("fields.price.placeholder"), required: true, step: "1", min: 0 },
    { name: "validFrom", kind: "date", label: t("fields.validFrom.label"), },
    { name: "validTo", kind: "date", label: t("fields.validTo.label") },
  ],
});
