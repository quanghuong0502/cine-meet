import { fnbComboService } from "@/services/master-data/fnb-combo.service";
import { createSection, formatValidity, formatVnd } from "../create-section";
import { removeFnbCombo, saveFnbCombo } from "./actions";

export const fnbCombosSection = createSection({
  key: "fnbCombos",
  service: fnbComboService,
  saveAction: saveFnbCombo,
  removeAction: removeFnbCombo,
  needsBrand: true,
  name: (combo) => combo.name,
  item: (combo, context) => ({
    title: combo.name,
    subtitle: [context.brandNames.get(combo.brandId.toString()), formatVnd(combo.price, context.locale)].filter(Boolean).join(" · "),
    meta: formatValidity(combo.validFrom, combo.validTo, context) ? [formatValidity(combo.validFrom, combo.validTo, context) as string] : undefined,
  }),
  values: (combo) => ({
    brandId: combo.brandId.toString(),
    name: combo.name,
    description: combo.description ?? "",
    price: combo.price.toString(),
    validFrom: combo.validFrom ?? "",
    validTo: combo.validTo ?? "",
  }),
  fields: ({ t, brandOptions }) => [
    { name: "brandId", kind: "select", label: t("fields.brandId.label"), required: true, options: brandOptions, placeholder: t("fields.brandId.placeholder") },
    { name: "name", kind: "text", label: t("fields.name.label"), required: true, maxLength: 80 },
    { name: "description", kind: "textarea", label: t("fields.description.label"), hint: t("fields.description.hint"), maxLength: 300 },
    { name: "price", kind: "number", label: t("fields.price.label"), hint: t("fields.price.hint"), required: true, step: "1", min: 0 },
    { name: "validFrom", kind: "date", label: t("fields.validFrom.label"), hint: t("fields.validFrom.hint") },
    { name: "validTo", kind: "date", label: t("fields.validTo.label") },
  ],
});
