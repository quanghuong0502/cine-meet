import { fnbComboService, priceOfCombo } from "@/services/master-data/fnb-combo.service";
import { fnbItemService } from "@/services/master-data/fnb-item.service";
import { createSection, formatValidity, formatVnd } from "../create-section";
import { removeFnbCombo, saveFnbCombo } from "./actions";

export const fnbCombosSection = createSection({
  key: "fnbCombos",
  service: fnbComboService,
  saveAction: saveFnbCombo,
  removeAction: removeFnbCombo,
  needsBrand: true,
  name: (combo) => combo.name,

  // The items of every brand, for the editor and for the names and prices on the cards.
  async loadExtra() {
    const items = await fnbItemService.list({});
    return {
      catalog: items.map((item) => ({ id: item._id.toString(), brandId: item.brandId.toString(), name: item.name, size: item.size ?? undefined, price: item.price })),
    };
  },

  item: (combo, context) => {
    const itemById = new Map(context.catalog.map((item) => [item.id, item]));
    const price = priceOfCombo(combo, new Map(context.catalog.map((item) => [item.id, item.price])));
    const validity = formatValidity(combo.validFrom, combo.validTo, context);
    return {
      title: combo.name,
      subtitle: [context.brandNames.get(combo.brandId.toString()), price ? formatVnd(price.price, context.locale) : context.t("noItems")].filter(Boolean).join(" · "),
      meta: [
        ...(combo.items ?? []).map((line) => {
          const item = itemById.get(line.itemId.toString());
          return item ? `${line.quantity} × ${item.size ? `${item.name} (${item.size})` : item.name}` : "";
        }).filter(Boolean),
        ...(validity ? [validity] : []),
      ],
    };
  },

  values: (combo) => ({
    brandId: combo.brandId.toString(),
    name: combo.name,
    items: JSON.stringify((combo.items ?? []).map((line) => ({ itemId: line.itemId.toString(), quantity: line.quantity }))),
    discountType: combo.discountType ?? "amount",
    discountValue: combo.discountValue ? String(combo.discountValue) : "",
    validFrom: combo.validFrom ?? "",
    validTo: combo.validTo ?? "",
  }),

  fields: ({ t, locale, brandOptions, catalog }) => [
    { name: "brandId", kind: "select", label: t("fields.brandId.label"), required: true, options: brandOptions, placeholder: t("fields.brandId.placeholder") },
    { name: "name", kind: "text", label: t("fields.name.label"), required: true, maxLength: 80 },
    {
      name: "items",
      kind: "comboItems",
      label: t("fields.items.label"),
      required: true,
      combo: {
        catalog,
        brandField: "brandId",
        locale,
        labels: {
          add: t("combo.add"),
          addPlaceholder: t("combo.addPlaceholder"),
          empty: t("combo.empty"),
          chooseBrand: t("combo.chooseBrand"),
          allAdded: t("combo.allAdded"),
          decrease: t("combo.decrease"),
          increase: t("combo.increase"),
          remove: t("combo.remove"),
          discountType: t("combo.discountType"),
          amount: t("combo.amount"),
          percent: t("combo.percent"),
          discountValue: t("combo.discountValue"),
          subtotal: t("combo.subtotal"),
          discount: t("combo.discount"),
          price: t("combo.price"),
        },
      },
    },
    { name: "validFrom", kind: "date", label: t("fields.validFrom.label") },
    { name: "validTo", kind: "date", label: t("fields.validTo.label") },
  ],
});
