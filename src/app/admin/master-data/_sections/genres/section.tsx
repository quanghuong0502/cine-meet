import { genreService } from "@/services/master-data/genre.service";
import { createSection } from "../create-section";
import { removeGenre, saveGenre } from "./actions";

export const genresSection = createSection({
  key: "genres",
  service: genreService,
  saveAction: saveGenre,
  removeAction: removeGenre,
  name: (genre) => genre.name,
  item: (genre, { tc }) => ({ title: genre.name, subtitle: genre.nameEn || undefined, meta: genre.active === false ? [tc("inactiveBadge")] : undefined }),
  values: (genre) => ({ name: genre.name, nameEn: genre.nameEn ?? "", active: genre.active === false ? "" : "on" }),
  defaults: { active: "on" },
  fields: ({ t, tc }) => [
    { name: "name", kind: "text", label: t("fields.name.label"), required: true, maxLength: 40 },
    { name: "nameEn", kind: "text", label: t("fields.nameEn.label"), maxLength: 40 },
    { name: "active", kind: "switch", label: tc("activeLabel") },
  ],
});
