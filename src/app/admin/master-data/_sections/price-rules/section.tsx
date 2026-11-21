import { branchService } from "@/services/master-data/branch.service";
import { formatService } from "@/services/master-data/format.service";
import { priceRuleService } from "@/services/master-data/price-rule.service";
import { seatTypeService } from "@/services/master-data/seat-type.service";
import { createSection, formatValidity, formatVnd } from "../create-section";
import { removePriceRule, savePriceRule } from "./actions";

interface Option {
  value: string;
  label: string;
}

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0] as const; // Monday first, as in Vietnam

/** The "Ticket prices" tab: one rule = a price for a brand or branch, narrowed by what the rule states. */
export const priceRulesSection = createSection({
  key: "priceRules",
  service: priceRuleService,
  saveAction: savePriceRule,
  removeAction: removePriceRule,
  needsBrand: true,
  name: (rule) => rule.note || String(rule.price),

  async loadExtra({ locale, t }) {
    const [branches, formats, seatTypes] = await Promise.all([
      branchService.list({}),
      formatService.list({}),
      seatTypeService.list({}),
    ]);
    const name = (doc: { name: string; nameEn?: string | null }) => (locale === "en" && doc.nameEn ? doc.nameEn : doc.name);
    return {
      branchById: new Map(branches.map((branch) => [branch._id.toString(), { name: branch.name, brandId: branch.brandId.toString() }])),
      formatNames: new Map(formats.map((format) => [format._id.toString(), format.name])),
      seatTypeNames: new Map(seatTypes.map((type) => [type._id.toString(), name(type)])),
      branches: branches.map((branch) => ({ id: branch._id.toString(), name: branch.name, brandId: branch.brandId.toString() })),
      formatOptions: [{ value: "any", label: t("any.format") }, ...formats.map((format) => ({ value: format._id.toString(), label: format.name }))],
      seatTypeOptions: [{ value: "any", label: t("any.seatType") }, ...seatTypes.map((type) => ({ value: type._id.toString(), label: name(type) }))],
    };
  },

  item: (rule, context) => {
    const { t, locale, brandNames, branchById, formatNames, seatTypeNames } = context;
    const branch = rule.branchId ? branchById.get(rule.branchId.toString()) : undefined;
    const where = branch
      ? `${brandNames.get(branch.brandId) ?? ""} · ${branch.name}`
      : t("scopeBrandName", { name: brandNames.get(rule.brandId?.toString() ?? "") ?? "" });
    const conditions: string[] = [];
    if (rule.formatId) conditions.push(formatNames.get(rule.formatId.toString()) ?? "");
    if (rule.seatTypeId) conditions.push(seatTypeNames.get(rule.seatTypeId.toString()) ?? "");
    if (rule.dayType) {
      conditions.push(
        rule.dayType === "promo" && rule.weekday != null
          ? t("dayType.promoOn", { day: t(`weekday.${rule.weekday}`) })
          : t(`dayType.${rule.dayType}`),
      );
    }
    if (rule.timeFrom && rule.timeTo) conditions.push(`${rule.timeFrom}–${rule.timeTo}`);
    const validity = formatValidity(rule.validFrom, rule.validTo, context);
    return {
      title: formatVnd(rule.price, locale),
      subtitle: [where, rule.note].filter(Boolean).join(" · "),
      meta: [...(conditions.length ? conditions : [t("allShowtimes")]), ...(validity ? [validity] : [])],
    };
  },

  values: (rule) => ({
    scope: rule.branchId ? `branch:${rule.branchId.toString()}` : `brand:${rule.brandId?.toString() ?? ""}`,
    formatId: rule.formatId?.toString() ?? "any",
    seatTypeId: rule.seatTypeId?.toString() ?? "any",
    dayType: rule.dayType ?? "any",
    weekday: rule.weekday != null ? String(rule.weekday) : "",
    timeFrom: rule.timeFrom ?? "",
    timeTo: rule.timeTo ?? "",
    price: String(rule.price),
    priority: String(rule.priority),
    validFrom: rule.validFrom ?? "",
    validTo: rule.validTo ?? "",
    note: rule.note ?? "",
  }),

  fields: ({ t, brandOptions, branches, brandNames, formatOptions, seatTypeOptions }) => {
    const scopeOptions: Option[] = [
      ...brandOptions.map((brand) => ({ value: `brand:${brand.value}`, label: t("scopeBrandName", { name: brand.label }) })),
      ...branches.map((branch) => ({ value: `branch:${branch.id}`, label: `${brandNames.get(branch.brandId) ?? ""} · ${branch.name}` })),
    ];
    return [
      { name: "scope", kind: "select", label: t("fields.scope.label"), required: true, options: scopeOptions, placeholder: t("fields.scope.placeholder") },
      { name: "price", kind: "number", money: true, label: t("fields.price.label"), placeholder: t("fields.price.placeholder"), required: true, step: "1", min: 0 },
      { name: "formatId", kind: "select", label: t("fields.formatId.label"), options: formatOptions, placeholder: t("any.format") },
      { name: "seatTypeId", kind: "select", label: t("fields.seatTypeId.label"), options: seatTypeOptions, placeholder: t("any.seatType") },
      {
        name: "dayType",
        kind: "select",
        label: t("fields.dayType.label"),
        placeholder: t("any.dayType"),
        options: [
          { value: "any", label: t("any.dayType") },
          { value: "normal", label: t("dayType.normal") },
          { value: "weekend", label: t("dayType.weekend") },
          { value: "holiday", label: t("dayType.holiday") },
          { value: "promo", label: t("dayType.promo") },
        ],
      },
      {
        name: "weekday",
        kind: "select",
        label: t("fields.weekday.label"),
        placeholder: t("fields.weekday.placeholder"),
        options: WEEKDAYS.map((day) => ({ value: String(day), label: t(`weekday.${day}`) })),
      },
      { name: "timeFrom", kind: "time", label: t("fields.timeFrom.label"), },
      { name: "timeTo", kind: "time", label: t("fields.timeTo.label") },
      { name: "validFrom", kind: "date", label: t("fields.validFrom.label"), },
      { name: "validTo", kind: "date", label: t("fields.validTo.label") },
      { name: "priority", kind: "number", label: t("fields.priority.label"), step: "1", min: 0, max: 100 },
      { name: "note", kind: "text", label: t("fields.note.label"), placeholder: t("fields.note.placeholder"), maxLength: 80 },
    ];
  },
});
