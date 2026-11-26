import type { TicketResult } from "@/lib/upload-types";

/** Shapes shared by the master-data list, the entry screen and the server pages that feed them. */

export type ResourceFieldKind = "text" | "textarea" | "url" | "color" | "number" | "select" | "switch" | "date" | "time" | "email" | "tel" | "image" | "comboItems" | "multiSelect" | "timeSlots";

/** One form field. All text is already translated by the server page, so the form holds no entity wording. */
export interface ResourceField {
  name: string;
  kind: ResourceFieldKind;
  /** Short label. A required field gets a "*"; there is no hint or description under a field (put a unit in the label, an example in `placeholder`). */
  label: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  /** Shown in a select that has no value yet. */
  placeholder?: string;
  /** For number fields: an amount in VND, typed and shown with dots ("100.000"), sent as plain digits. */
  money?: boolean;
  /** For number fields. */
  step?: string;
  min?: number;
  max?: number;
  maxLength?: number;
  /** For `image` fields: the server action that signs the upload. */
  uploadTicket?: () => Promise<TicketResult>;
  /** For `image` fields: `poster` previews the picture in a movie poster's 2:3 shape instead of cropping it square (a logo stays square). */
  imageShape?: "poster";
  /** An identifier or code: no auto-capitalisation, auto-correct or spell-check. */
  plain?: boolean;
  /** Shows a one-tap copy button inside the input (used for generated temporary passwords). */
  copyable?: boolean;
  /** For `comboItems` fields: what the items editor needs. */
  combo?: ComboFieldConfig;
}

/** The combo items editor (kind `comboItems`): a picker of items with quantities, a discount, and the computed price. */
export interface ComboFieldConfig {
  /** Items of every brand; the editor lists the ones of the brand picked in the form. */
  catalog: { id: string; brandId: string; name: string; size?: string; price: number }[];
  /** Name of the select field that holds the brand. */
  brandField: string;
  locale: string;
  labels: {
    add: string;
    addPlaceholder: string;
    empty: string;
    chooseBrand: string;
    allAdded: string;
    decrease: string;
    increase: string;
    remove: string;
    discountType: string;
    amount: string;
    percent: string;
    discountValue: string;
    subtotal: string;
    discount: string;
    price: string;
  };
}

/** One card in a master-data list. */
export interface ResourceItem {
  id: string;
  title: string;
  subtitle?: string;
  meta?: string[];
  /** A picture shown in the round marker (a logo); the colour shows when there is none. */
  imageUrl?: string;
  /** `poster` shows the picture in a movie poster's 2:3 shape instead of cropping it square. */
  imageShape?: "poster";
  /** Letters shown inside the round marker (initials of a person). */
  avatarText?: string;
  /** Colour dot, as #rrggbb. */
  color?: string;
}

export interface ResourceLabels {
  addButton: string;
  emptyTitle: string;
  emptyDescription: string;
}
