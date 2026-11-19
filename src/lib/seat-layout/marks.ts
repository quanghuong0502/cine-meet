/** Where a seat sits in a layout version; two versions have "the same seat" when code and position agree. */
export interface SeatPlace {
  code: string;
  rowIndex: number;
  colIndex: number;
  span: number;
}

export interface MarkLike {
  seatCode: string;
  layoutId: string;
}

/**
 * Splits a person's marks for one room into the ones that still apply to the layout being viewed and the old ones.
 * A mark applies when the seat it was made on is still there: same code, same row and column, same width.
 * Marks made on the viewed layout itself always apply. Anything else (seat moved, widened or removed) is "old".
 */
export function matchMarks<M extends MarkLike>(
  marks: M[],
  viewedLayoutId: string,
  viewedSeats: SeatPlace[],
  seatsOfLayout: ReadonlyMap<string, SeatPlace[]>,
): { active: M[]; old: M[] } {
  const viewed = new Map(viewedSeats.map((s) => [s.code, s]));
  const active: M[] = [];
  const old: M[] = [];
  for (const mark of marks) {
    const here = viewed.get(mark.seatCode);
    if (!here) {
      old.push(mark);
      continue;
    }
    if (mark.layoutId === viewedLayoutId) {
      active.push(mark);
      continue;
    }
    const origin = seatsOfLayout.get(mark.layoutId)?.find((s) => s.code === mark.seatCode);
    const same = origin && origin.rowIndex === here.rowIndex && origin.colIndex === here.colIndex && origin.span === here.span;
    (same ? active : old).push(mark);
  }
  return { active, old };
}
