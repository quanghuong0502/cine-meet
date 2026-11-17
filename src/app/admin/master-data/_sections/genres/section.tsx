import { genreService } from "@/services/master-data/genre.service";
import { createSection } from "../create-section";
import { removeGenre, saveGenre } from "./actions";

export const genresSection = createSection({
  key: "genres",
  service: genreService,
  saveAction: saveGenre,
  removeAction: removeGenre,
  name: (genre) => genre.name,
  item: (genre) => ({ title: genre.name, subtitle: genre.nameEn || undefined }),
  values: (genre) => ({ name: genre.name, nameEn: genre.nameEn ?? "" }),
  fields: ({ t }) => [
    { name: "name", kind: "text", label: t("fields.name.label"), required: true, maxLength: 40 },
    { name: "nameEn", kind: "text", label: t("fields.nameEn.label"), hint: t("fields.nameEn.hint"), maxLength: 40 },
  ],
});
