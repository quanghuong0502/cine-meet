import type { ResourceField } from "@/components/admin/resource-types";
import type { RemoveResult, SaveState } from "@/lib/admin/action-result";

/** What a section needs to show its entry screen (create when `id` is null, edit otherwise). */
export interface SectionFormData {
  title: string;
  fields: ResourceField[];
  /** Starting values by field name; empty when creating. */
  values: Record<string, string>;
  /** Shown in the delete confirmation. */
  itemName?: string;
  saveAction: (previous: SaveState, formData: FormData) => Promise<SaveState>;
  removeAction: (id: string) => Promise<RemoveResult>;
}

/** One master-data type: its list (a tab of the Catalog page) and its entry screen. */
export interface SectionDefinition {
  List: (props: { q: string }) => Promise<React.JSX.Element>;
  /** Returns null when the record does not exist (the page then shows "not found"). */
  loadForm: (id: string | null) => Promise<SectionFormData | null>;
}
