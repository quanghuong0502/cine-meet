import { holidayService } from "@/services/master-data/holiday.service";
import { createSection, formatDay } from "../create-section";
import { removeHoliday, saveHoliday } from "./actions";

export const holidaysSection = createSection({
  key: "holidays",
  service: holidayService,
  saveAction: saveHoliday,
  removeAction: removeHoliday,
  name: (holiday) => holiday.name,
  item: (holiday, { locale }) => ({ title: holiday.name, subtitle: formatDay(holiday.date, locale) }),
  values: (holiday) => ({ date: holiday.date, name: holiday.name, nameEn: holiday.nameEn ?? "" }),
  fields: ({ t }) => [
    { name: "date", kind: "date", label: t("fields.date.label"), required: true },
    { name: "name", kind: "text", label: t("fields.name.label"), required: true, maxLength: 80 },
    { name: "nameEn", kind: "text", label: t("fields.nameEn.label"), maxLength: 80 },
  ],
});
