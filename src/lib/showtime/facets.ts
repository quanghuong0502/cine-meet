import { FILTER_KEYS, type FilterKey, type FilterValues } from "@/lib/showtime/filters";

/** What the filters need to know about one showtime of the day: plain ids, so the list can be sent to the browser as it is. */
export interface FacetRecord {
  branch: string;
  format: string;
  /** The movie's genres. */
  genre: string[];
  /** Ids of the time slots the start time falls in. */
  slot: string[];
}

function has(record: FacetRecord, key: FilterKey, value: string): boolean {
  const field = record[key];
  return Array.isArray(field) ? field.includes(value) : field === value;
}

/** Whether a showtime passes every filter in force, except `skip` (used to ask "what could this group still offer"). */
function passes(record: FacetRecord, values: FilterValues, skip?: FilterKey): boolean {
  return FILTER_KEYS.every((key) => key === skip || !values[key] || has(record, key, values[key]));
}

/** How many showtimes the filters leave. */
export function countMatching(records: FacetRecord[], values: FilterValues): number {
  return records.filter((record) => passes(record, values)).length;
}

/**
 * For each group, the values that still have a showtime once the OTHER groups' choices are applied (a group's own choice does not
 * limit itself, so the person can switch within it). Picking from what is offered never leads to an empty list.
 */
export function availableValues(records: FacetRecord[], values: FilterValues): Record<FilterKey, Set<string>> {
  const result = {} as Record<FilterKey, Set<string>>;
  for (const key of FILTER_KEYS) {
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
