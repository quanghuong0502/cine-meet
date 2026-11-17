import { getBranchImageUploadTicket } from "@/actions/uploads";
import { branchService } from "@/services/master-data/branch.service";
import { createSection, formatVnd } from "../create-section";
import { removeBranch, saveBranch } from "./actions";

export const branchesSection = createSection({
  key: "branches",
  service: branchService,
  saveAction: saveBranch,
  removeAction: removeBranch,
  needsBrand: true,
  name: (branch) => branch.name,
  item: (branch, { brandNames, t, locale }) => ({
    title: branch.name,
    imageUrl: branch.imageUrl ?? undefined,
    subtitle: [brandNames.get(branch.brandId.toString()), branch.address].filter(Boolean).join(" · ") || undefined,
    meta: branch.parkingFee != null ? [t("parkingBadge", { fee: formatVnd(branch.parkingFee, locale) })] : undefined,
  }),
  values: (branch) => ({
    brandId: branch.brandId.toString(),
    name: branch.name,
    address: branch.address ?? "",
    mapsUrl: branch.mapsUrl ?? "",
    imageUrl: branch.imageUrl ?? "",
    floor: branch.floor ?? "",
    openingHours: branch.openingHours ?? "",
    parkingFee: branch.parkingFee?.toString() ?? "",
    parkingLocation: branch.parkingLocation ?? "",
    parkingEntrance: branch.parkingEntrance ?? "",
  }),
  fields: ({ t, brandOptions }) => [
    { name: "brandId", kind: "select", label: t("fields.brandId.label"), required: true, options: brandOptions, placeholder: t("fields.brandId.placeholder") },
    { name: "name", kind: "text", label: t("fields.name.label"), required: true, maxLength: 80 },
    { name: "address", kind: "textarea", label: t("fields.address.label"), maxLength: 200 },
    { name: "mapsUrl", kind: "url", label: t("fields.mapsUrl.label"), maxLength: 300 },
    { name: "imageUrl", kind: "image", label: t("fields.imageUrl.label"), uploadTicket: getBranchImageUploadTicket },
    { name: "floor", kind: "text", label: t("fields.floor.label"), placeholder: t("fields.floor.placeholder"), maxLength: 40 },
    { name: "openingHours", kind: "text", label: t("fields.openingHours.label"), placeholder: t("fields.openingHours.placeholder"), maxLength: 60 },
    { name: "parkingFee", kind: "number", label: t("fields.parkingFee.label"), placeholder: t("fields.parkingFee.placeholder"), step: "1", min: 0 },
    { name: "parkingLocation", kind: "text", label: t("fields.parkingLocation.label"), maxLength: 120 },
    { name: "parkingEntrance", kind: "text", label: t("fields.parkingEntrance.label"), maxLength: 120 },
  ],
});
