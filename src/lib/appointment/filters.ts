import type { AppointmentStatus } from "@/lib/appointment/state";

/** The filters of the appointment list, shared by the server page and the client filter bar. */
export const FILTER_KEYS = ["status", "role"] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];
export type FilterValues = Partial<Record<FilterKey, string>>;

export const FILTER_CHOICES: Record<FilterKey, readonly string[]> = {
  status: [
    "reply",
    "inviting",
    "locked",
    "planning",
    "confirmed",
    "completed",
    "cancelled",
    "draft",
  ],
  role: ["mine", "invited"],
};

/** What the filters need to know about one appointment: plain values, so the list can go to the browser as it is. */
export interface FacetRecord {
  status: AppointmentStatus;
  needsReply: boolean;
  isCreator: boolean;
}

function matches(record: FacetRecord, key: FilterKey, value: string): boolean {
  if (key === "role")
    return value === "mine" ? record.isCreator : !record.isCreator;
  switch (value) {
    case "reply":
      return record.needsReply;
    case "inviting":
      return record.status === "INVITING";
    case "locked":
      return record.status === "PARTICIPANTS_LOCKED";
    case "planning":
      return record.status === "PLANNING";
    case "confirmed":
      return record.status === "CONFIRMED";
    case "completed":
      return record.status === "COMPLETED";
    case "cancelled":
      return record.status === "CANCELLED";
    default:
      return record.status === "DRAFT";
  }
}

/** Drops values that are not a known choice, so a hand-edited URL cannot filter on nonsense. */
export function parseFilters(
  raw: Partial<Record<FilterKey, string | undefined>>,
): FilterValues {
  const values: FilterValues = {};
  for (const key of FILTER_KEYS) {
    const value = raw[key];
    if (value && FILTER_CHOICES[key].includes(value)) values[key] = value;
  }
  return values;
}

function passes(
  record: FacetRecord,
  values: FilterValues,
  skip?: FilterKey,
): boolean {
  return FILTER_KEYS.every(
    (key) => key === skip || !values[key] || matches(record, key, values[key]),
  );
}

export function applyFilters<T extends FacetRecord>(
  records: T[],
  values: FilterValues,
): T[] {
  return records.filter((record) => passes(record, values));
}

/** Per group, the choices that still leave at least one appointment once the OTHER groups' choices are applied. */
export function availableValues(
  records: FacetRecord[],
  values: FilterValues,
): Record<FilterKey, Set<string>> {
  const result = {} as Record<FilterKey, Set<string>>;
  for (const key of FILTER_KEYS) {
    result[key] = new Set(
      FILTER_CHOICES[key].filter((value) =>
        records.some((r) => passes(r, values, key) && matches(r, key, value)),
      ),
    );
  }
  return result;
}
