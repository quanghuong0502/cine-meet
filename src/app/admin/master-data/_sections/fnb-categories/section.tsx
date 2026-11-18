import { fnbCategoryService } from "@/services/master-data/fnb-category.service";
import { createSection } from "../create-section";
import { removeFnbCategory, saveFnbCategory } from "./actions";

export const fnbCategoriesSection = createSection({
  key: "fnbCategories",
  service: fnbCategoryService,
  saveAction: saveFnbCategory,
  removeAction: removeFnbCategory,
  name: (category) => category.name,
  item: (category, { tc }) => ({ title: category.name, subtitle: category.nameEn || undefined, meta: category.active === false ? [tc("inactiveBadge")] : undefined }),
  values: (category) => ({ name: category.name, nameEn: category.nameEn ?? "", active: category.active === false ? "" : "on" }),
  defaults: { active: "on" },
  fields: ({ t, tc }) => [
    { name: "name", kind: "text", label: t("fields.name.label"), required: true, maxLength: 40 },
    { name: "nameEn", kind: "text", label: t("fields.nameEn.label"), maxLength: 40 },
    { name: "active", kind: "switch", label: tc("activeLabel") },
  ],
});
