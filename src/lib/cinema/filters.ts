/** The filters of the cinema list, shared by the server page and the client filter bar. Same shape as the showtime filters (`lib/showtime`). */
export const CINEMA_FILTER_KEYS = ["brand", "format", "frequent"] as const;
export type CinemaFilterKey = (typeof CINEMA_FILTER_KEYS)[number];
export type CinemaFilterValues = Partial<Record<CinemaFilterKey, string>>;

/** What the filters need to know about one branch: plain ids. `frequent` is "1" for a branch the person often visits. */
export interface CinemaFacet {
  brand: string;
  /** Formats of the branch's upcoming showtimes. */
  format: string[];
  frequent: string[];
}

function has(record: CinemaFacet, key: CinemaFilterKey, value: string): boolean {
  const field = record[key];
  return Array.isArray(field) ? field.includes(value) : field === value;
}

function passes(record: CinemaFacet, values: CinemaFilterValues, skip?: CinemaFilterKey): boolean {
  return CINEMA_FILTER_KEYS.every((key) => key === skip || !values[key] || has(record, key, values[key]));
}

export function filterCinemas<T extends CinemaFacet>(records: T[], values: CinemaFilterValues): T[] {
  return records.filter((record) => passes(record, values));
}

export function countCinemas(records: CinemaFacet[], values: CinemaFilterValues): number {
  return filterCinemas(records, values).length;
}

/** Per group, the values that still have a branch once the OTHER groups' choices are applied (picking from what is offered never gives an empty list). */
export function availableCinemaValues(records: CinemaFacet[], values: CinemaFilterValues): Record<CinemaFilterKey, Set<string>> {
  const result = {} as Record<CinemaFilterKey, Set<string>>;
  for (const key of CINEMA_FILTER_KEYS) {
    const found = new Set<string>();
    for (const record of records) {
      if (!passes(record, values, key)) continue;
      const field = record[key];
      for (const value of Array.isArray(field) ? field : [field]) found.add(value);
    }
    result[key] = found;
  }
  return result;
}
