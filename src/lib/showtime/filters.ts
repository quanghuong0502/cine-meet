/** The filters of the showtime list, shared by the server page and the client filter bar (a "use client" file cannot hand a value to a server component). */
export const FILTER_KEYS = ["movie", "branch", "genre", "format", "slot"] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];
export type FilterValues = Partial<Record<FilterKey, string>>;
