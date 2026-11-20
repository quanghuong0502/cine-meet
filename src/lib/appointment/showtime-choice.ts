import type { ShowtimeRow } from "@/services/showtime.service";

export interface ShowtimeChoice {
  id: string;
  startAt: string;
  branchId: string;
  branchName: string;
  endAt: string;
  roomName: string;
  formatName: string;
  /** Whole dong; null when no price rule matches. The range shows when seat types differ. */
  price: number | null;
  priceMin: number | null;
  priceMax: number | null;
}

/**
 * A showtime row as the picker lists it (the cinema is shown as "Brand · Branch"). A plain function, kept outside any
 * `"use client"` file: a Server Component (`appointments/new/page.tsx`) calls it directly to pre-fill the form, and a
 * component export from a client module cannot be called like that from the server.
 */
export function toShowtimeChoice(row: ShowtimeRow): ShowtimeChoice {
  return {
    id: row.id,
    startAt: row.startAt,
    endAt: row.endAt,
    branchId: row.branch.id,
    branchName: [row.branch.brandName, row.branch.name].filter(Boolean).join(" · "),
    roomName: row.auditorium.name,
    formatName: row.format.name,
    price: row.price,
    priceMin: row.priceMin,
    priceMax: row.priceMax,
  };
}
