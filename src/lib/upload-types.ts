import type { UploadTicket } from "@/lib/cloudinary";

/** What a "get an upload ticket" server action answers. */
export type TicketResult = { ok: true; ticket: UploadTicket } | { ok: false; error: "not_configured" };
