/** Suggests where a group can sit together: the run of neighbouring seats in one row with the best total score. Pure. */

export interface SuggestSeat {
  code: string;
  rowIndex: number;
  colIndex: number;
  /** 1 single seat, 2 couple seat. */
  span: number;
  score: number;
  flags: readonly string[];
}

/**
 * Picks `people` places side by side. A couple seat counts for two people. Seats in `taken` and broken seats are never used.
 * Returns the seat codes (best first choice), or null when no row has enough room in one run.
 */
export function suggestTogether(seats: readonly SuggestSeat[], taken: ReadonlySet<string>, people: number): string[] | null {
  if (people < 1) return null;
  const free = seats.filter((s) => !taken.has(s.code) && !s.flags.includes("broken"));
  const rows = new Map<number, SuggestSeat[]>();
  for (const seat of free) rows.set(seat.rowIndex, [...(rows.get(seat.rowIndex) ?? []), seat]);

  let best: { codes: string[]; score: number } | null = null;
  for (const row of rows.values()) {
    row.sort((a, b) => a.colIndex - b.colIndex);
    for (let start = 0; start < row.length; start++) {
      const codes: string[] = [];
      let capacity = 0;
      let score = 0;
      for (let i = start; i < row.length && capacity < people; i++) {
        const previous = row[i - 1];
        // The run must be unbroken: the next seat starts right where the last one ends.
        if (i > start && previous && row[i]!.colIndex !== previous.colIndex + previous.span) break;
        codes.push(row[i]!.code);
        capacity += row[i]!.span;
        score += row[i]!.score;
      }
      if (capacity < people) continue;
      const average = score / codes.length;
      if (!best || average > best.score) best = { codes, score: average };
    }
  }
  return best?.codes ?? null;
}
