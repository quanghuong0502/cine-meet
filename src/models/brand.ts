import { Schema, type InferSchemaType, type Model } from "mongoose";
import { defineModel } from "@/lib/define-model";
import { ROOM_3D_PRESET_IDS } from "@/lib/seat-layout/room-3d-appearance.defaults";

/** A cinema chain (CGV, BHD, Beta, Lotte, Galaxy...). */
const brandSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    logoUrl: { type: String, trim: true },
    // Brand colour as #rrggbb, used to tint cards and chips.
    color: { type: String, trim: true },
    websiteUrl: { type: String, trim: true },
    appUrl: { type: String, trim: true },
    /** Optional 3D auditorium visual theme preset for this brand; unset inherits system defaults. */
    room3dPreset: { type: String, enum: ROOM_3D_PRESET_IDS },
    // Off = hidden from the user app and from new pick-lists; records that point at it stay as they are. A missing value counts as on.
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// Names are unique ignoring case and accents ("cgv" equals "CGV").
brandSchema.index({ name: 1 }, { unique: true, collation: { locale: "vi", strength: 1 } });

export type BrandDoc = InferSchemaType<typeof brandSchema>;

export const Brand: Model<BrandDoc> =
  defineModel<BrandDoc>("Brand", brandSchema);
