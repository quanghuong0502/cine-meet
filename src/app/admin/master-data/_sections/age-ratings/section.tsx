import { ageRatingService } from "@/services/master-data/age-rating.service";
import { createSection } from "../create-section";
import { removeAgeRating, saveAgeRating } from "./actions";

export const ageRatingsSection = createSection({
  key: "ageRatings",
  service: ageRatingService,
  saveAction: saveAgeRating,
  removeAction: removeAgeRating,
  name: (rating) => rating.code,
  item: (rating, { t }) => ({
    title: rating.code,
    subtitle: rating.description,
    meta: [t("minAgeBadge", { age: rating.minAge })],
  }),
  values: (rating) => ({
    code: rating.code,
    description: rating.description,
    descriptionEn: rating.descriptionEn ?? "",
    minAge: rating.minAge.toString(),
  }),
  fields: ({ t }) => [
    { name: "code", kind: "text", label: t("fields.code.label"), hint: t("fields.code.hint"), required: true, maxLength: 10 },
    { name: "description", kind: "text", label: t("fields.description.label"), required: true, maxLength: 120 },
    { name: "descriptionEn", kind: "text", label: t("fields.descriptionEn.label"), hint: t("fields.descriptionEn.hint"), maxLength: 120 },
    { name: "minAge", kind: "number", label: t("fields.minAge.label"), hint: t("fields.minAge.hint"), required: true, step: "1", min: 0, max: 21 },
  ],
});
