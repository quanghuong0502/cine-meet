export interface EditorSeatType {
  id: string;
  /** Already in the viewer's language. */
  name: string;
  color: string | null;
  capacity: number;
}

export interface EditorVersion {
  id: string;
  version: number;
  seatCount: number;
  /** ISO string. */
  createdAt: string;
  current: boolean;
}
