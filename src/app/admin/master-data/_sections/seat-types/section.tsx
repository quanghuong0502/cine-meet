import { seatTypeService } from "@/services/master-data/seat-type.service";
import { createSection } from "../create-section";
import { removeSeatType, saveSeatType } from "./actions";

export const seatTypesSection = createSection({
  key: "seatTypes",
  service: seatTypeService,
  saveAction: saveSeatType,
  removeAction: removeSeatType,
  name: (type) => type.name,
  item: (type, { t }) => ({
    title: type.name,
    subtitle: type.nameEn || undefined,
    meta: [t(type.capacity === 2 ? "capacityCouple" : "capacitySingle")],
    color: type.color ?? undefined,
  }),
  values: (type) => ({
    name: type.name,
    nameEn: type.nameEn ?? "",
    capacity: String(type.capacity),
    color: type.color ?? "",
  }),
  fields: ({ t }) => [
    { name: "name", kind: "text", label: t("fields.name.label"), required: true, maxLength: 40 },
    { name: "nameEn", kind: "text", label: t("fields.nameEn.label"), maxLength: 40 },
    {
      name: "capacity",
      kind: "select",
      label: t("fields.capacity.label"),
      required: true,
      placeholder: t("fields.capacity.placeholder"),
      options: [
        { value: "1", label: t("capacitySingle") },
        { value: "2", label: t("capacityCouple") },
      ],
    },
    { name: "color", kind: "color", label: t("fields.color.label"), },
  ],
});
