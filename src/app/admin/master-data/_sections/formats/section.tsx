import { formatService } from "@/services/master-data/format.service";
import { createSection } from "../create-section";
import { removeFormat, saveFormat } from "./actions";

export const formatsSection = createSection({
  key: "formats",
  service: formatService,
  saveAction: saveFormat,
  removeAction: removeFormat,
  name: (format) => format.name,
  item: (format, { tc }) => ({ title: format.name, meta: format.active === false ? [tc("inactiveBadge")] : undefined }),
  values: (format) => ({ name: format.name, active: format.active === false ? "" : "on" }),
  defaults: { active: "on" },
  fields: ({ t, tc }) => [
    { name: "name", kind: "text", label: t("fields.name.label"), placeholder: t("fields.name.placeholder"), required: true, maxLength: 30 },
    { name: "active", kind: "switch", label: tc("activeLabel") },
  ],
});
