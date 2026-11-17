import type { TicketResult } from "@/lib/upload-types";

/** Shapes shared by the master-data list, the entry screen and the server pages that feed them. */

export type ResourceFieldKind = "text" | "textarea" | "url" | "color" | "number" | "select" | "switch" | "date" | "time" | "email" | "tel" | "image";

/** One form field. All text is already translated by the server page, so the form holds no entity wording. */
export interface ResourceField {
  name: string;
  kind: ResourceFieldKind;
  label: string;
  hint?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  /** Shown in a select that has no value yet. */
  placeholder?: string;
  /** For number fields. */
  step?: string;
  min?: number;
  max?: number;
  maxLength?: number;
  /** For `image` fields: the server action that signs the upload. */
  uploadTicket?: () => Promise<TicketResult>;
  /** An identifier or code: no auto-capitalisation, auto-correct or spell-check. */
  plain?: boolean;
}

/** One card in a master-data list. */
export interface ResourceItem {
  id: string;
  title: string;
  subtitle?: string;
  meta?: string[];
  /** A picture shown in the round marker (a logo); the colour shows when there is none. */
  imageUrl?: string;
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
