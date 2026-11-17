import { fnbItemService } from "@/services/master-data/fnb-item.service";
import { createSection, formatValidity, formatVnd } from "../create-section";
import { removeFnbItem, saveFnbItem } from "./actions";

export const fnbItemsSection = createSection({
  key: "fnbItems",
  service: fnbItemService,
  saveAction: saveFnbItem,
  removeAction: removeFnbItem,
  needsBrand: true,
  name: (item) => item.name,
  item: (item, context) => ({
    title: item.size ? `${item.name} (${item.size})` : item.name,
    subtitle: [context.brandNames.get(item.brandId.toString()), formatVnd(item.price, context.locale)].filter(Boolean).join(" · "),
    meta: formatValidity(item.validFrom, item.validTo, context) ? [formatValidity(item.validFrom, item.validTo, context) as string] : undefined,
  }),
  values: (item) => ({
    brandId: item.brandId.toString(),
    name: item.name,
    nameEn: item.nameEn ?? "",
    size: item.size ?? "",
    price: item.price.toString(),
    validFrom: item.validFrom ?? "",
    validTo: item.validTo ?? "",
  }),
  fields: ({ t, brandOptions }) => [
    { name: "brandId", kind: "select", label: t("fields.brandId.label"), required: true, options: brandOptions, placeholder: t("fields.brandId.placeholder") },
    { name: "name", kind: "text", label: t("fields.name.label"), required: true, maxLength: 80 },
    { name: "nameEn", kind: "text", label: t("fields.nameEn.label"), maxLength: 80 },
    { name: "size", kind: "text", label: t("fields.size.label"), placeholder: t("fields.size.placeholder"), maxLength: 30 },
    { name: "price", kind: "number", label: t("fields.price.label"), placeholder: t("fields.price.placeholder"), required: true, step: "1", min: 0 },
    { name: "validFrom", kind: "date", label: t("fields.validFrom.label"), },
    { name: "validTo", kind: "date", label: t("fields.validTo.label") },
  ],
});
