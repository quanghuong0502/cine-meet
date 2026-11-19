import { defaultRatingColor, ratingColor } from "@/lib/age-rating-color";
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
    color: ratingColor(rating),
  }),
  values: (rating) => ({
    code: rating.code,
    description: rating.description,
    descriptionEn: rating.descriptionEn ?? "",
    minAge: rating.minAge.toString(),
    color: ratingColor(rating),
  }),
  // A new rating starts on the "everyone" colour; the admin picks the colour that fits its age.
  defaults: { color: defaultRatingColor("P", 0) },
  fields: ({ t }) => [
    { name: "code", kind: "text", label: t("fields.code.label"), placeholder: t("fields.code.placeholder"), required: true, maxLength: 10 },
    { name: "description", kind: "text", label: t("fields.description.label"), required: true, maxLength: 120 },
    { name: "descriptionEn", kind: "text", label: t("fields.descriptionEn.label"), maxLength: 120 },
    { name: "minAge", kind: "number", label: t("fields.minAge.label"), required: true, step: "1", min: 0, max: 21 },
    { name: "color", kind: "color", label: t("fields.color.label") },
  ],
});
