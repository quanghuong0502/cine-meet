/** Mark vocabulary, kept apart from the Mongoose model so client components can import it without pulling in the database layer. */
export const SEAT_MARK_KINDS = ["favorite", "avoid"] as const;
export type SeatMarkKind = (typeof SEAT_MARK_KINDS)[number];
export const SEAT_MARK_TAGS = ["aisle", "near_door", "obstructed", "loose", "near_speaker"] as const;
export type SeatMarkTag = (typeof SEAT_MARK_TAGS)[number];
