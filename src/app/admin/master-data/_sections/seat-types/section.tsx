import { DEFAULT_SEAT_3D_COLOR } from "@/lib/seat-layout/scene";
import { SEAT_STYLES } from "@/lib/seat-layout/types";
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
    meta: [
      t(type.capacity === 2 ? "capacityCouple" : "capacitySingle"),
      ...(type.style && type.style !== "standard" ? [t(`styles.${type.style}`)] : []),
    ],
    color: type.color ?? undefined,
  }),
  defaults: {
    color3d: DEFAULT_SEAT_3D_COLOR,
  },
  values: (type) => ({
    name: type.name,
    nameEn: type.nameEn ?? "",
    capacity: String(type.capacity),
    style: type.style ?? "standard",
    color: type.color ?? "",
    color3d: type.color3d ?? DEFAULT_SEAT_3D_COLOR,
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
    {
      name: "style",
      kind: "select",
      label: t("fields.style.label"),
      placeholder: t("fields.style.placeholder"),
      options: SEAT_STYLES.map((value) => ({ value, label: t(`styles.${value}`) })),
    },
    { name: "color", kind: "color", label: t("fields.color.label") },
    { name: "color3d", kind: "color", label: t("fields.color3d.label") },
  ],
});
