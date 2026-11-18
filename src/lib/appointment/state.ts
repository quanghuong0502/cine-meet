/** Appointment life cycle (design 3.4). Stage 1 (invite and lock people) is Sprint 4; PLANNING onward is Sprint 5A. */
export const APPOINTMENT_STATUSES = ["DRAFT", "INVITING", "PARTICIPANTS_LOCKED", "PLANNING", "CONFIRMED", "COMPLETED", "CANCELLED"] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

const FORWARD: Record<AppointmentStatus, AppointmentStatus[]> = {
  DRAFT: ["INVITING"],
  INVITING: ["PARTICIPANTS_LOCKED"],
  PARTICIPANTS_LOCKED: ["PLANNING"],
  PLANNING: ["CONFIRMED"],
  CONFIRMED: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

/** A move is allowed one step forward, or to CANCELLED from any step before COMPLETED. Nothing leaves COMPLETED or CANCELLED. */
export function canTransition(from: AppointmentStatus, to: AppointmentStatus): boolean {
  if (to === "CANCELLED") return from !== "COMPLETED" && from !== "CANCELLED";
  return FORWARD[from].includes(to);
}

export const PARTICIPANT_STATUSES = ["invited", "accepted", "declined", "dropped", "excluded"] as const;
export type ParticipantStatus = (typeof PARTICIPANT_STATUSES)[number];

/** Statuses in which people may still answer: reply, vote, suggest another time. */
export function isOpenForReplies(status: AppointmentStatus): boolean {
  return status === "INVITING";
}

/** Statuses in which an attendee may leave on their own (design 3.4: from PARTICIPANTS_LOCKED to CONFIRMED, before the showtime). */
export function canWithdraw(status: AppointmentStatus): boolean {
  return status === "PARTICIPANTS_LOCKED" || status === "PLANNING" || status === "CONFIRMED";
}

/** Appointments that are over (cancelled or watched) and move to the "past" list. */
export function isFinished(status: AppointmentStatus): boolean {
  return status === "COMPLETED" || status === "CANCELLED";
}

export interface VoteLike {
  userId: string;
  vote: "yes" | "no";
}

/** People who said yes to an option: the default attendee list when the creator picks that option. */
export function yesVoterIds(votes: VoteLike[]): string[] {
  return votes.filter((v) => v.vote === "yes").map((v) => v.userId);
}

/** Whether a person who has not answered by the deadline should be labelled "overdue". The appointment itself never cancels. */
export function isOverdue(deadline: Date | null | undefined, participantStatus: ParticipantStatus, now = new Date()): boolean {
  return Boolean(deadline) && participantStatus === "invited" && deadline!.getTime() < now.getTime();
}

/**
 * Where an appointment sits in the current list, lowest first: the ones waiting for this person's answer, then confirmed, planning,
 * people locked, still inviting, and drafts last. Within one rank: confirmed ones by showtime (soonest first), the others by the
 * time they were made (earliest first).
 */
export function listRank(status: AppointmentStatus, needsReply: boolean): number {
  if (needsReply) return 0;
  switch (status) {
    case "CONFIRMED":
      return 1;
    case "PLANNING":
      return 2;
    case "PARTICIPANTS_LOCKED":
      return 3;
    case "INVITING":
      return 4;
    default:
      return 5;
  }
}

export function compareForList(
  a: { status: AppointmentStatus; needsReply: boolean; startAt: string; createdAt: string },
  b: { status: AppointmentStatus; needsReply: boolean; startAt: string; createdAt: string },
): number {
  const rank = listRank(a.status, a.needsReply) - listRank(b.status, b.needsReply);
  if (rank !== 0) return rank;
  if (listRank(a.status, a.needsReply) === 1) return a.startAt.localeCompare(b.startAt);
  return a.createdAt.localeCompare(b.createdAt);
}
