import type { SeatStyle } from "@/lib/seat-layout/types";

export interface EditorSeatType {
  id: string;
  /** Already in the viewer's language. */
  name: string;
  color: string | null;
  color3d?: string | null;
  capacity: number;
  style: SeatStyle;
}
