import { formatService } from "@/services/master-data/format.service";
import { createSection } from "../create-section";
import { removeFormat, saveFormat } from "./actions";

export const formatsSection = createSection({
  key: "formats",
  service: formatService,
  saveAction: saveFormat,
  removeAction: removeFormat,
  name: (format) => format.name,
  item: (format) => ({ title: format.name }),
  values: (format) => ({ name: format.name }),
  fields: ({ t }) => [
    { name: "name", kind: "text", label: t("fields.name.label"), hint: t("fields.name.hint"), required: true, maxLength: 30 },
  ],
});
