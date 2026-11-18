import { Error as MongooseError, isValidObjectId, type HydratedDocument } from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { MAX_DECLINE_REASON, MAX_INVITEES, MAX_TIME_OPTIONS } from "@/lib/appointment/limits";
import {
  canTransition,
  canWithdraw,
  isFinished,
  isOpenForReplies,
  isOverdue,
  type AppointmentStatus,
  type ParticipantStatus,
} from "@/lib/appointment/state";
import { Appointment, type AppointmentDoc } from "@/models/appointment";
import { Auditorium } from "@/models/auditorium";
import { Branch } from "@/models/branch";
import { Movie } from "@/models/movie";
import { Showtime } from "@/models/showtime";
import { User } from "@/models/user";
import { filterFriendIds, type PersonView } from "@/services/friend.service";
import { enqueueNotifications } from "@/notifications/outbox";
import type { NotificationPayload, NotificationType } from "@/notifications/types";

type Doc = HydratedDocument<AppointmentDoc>;

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, { error: "invalid" });

const optionInputSchema = z.object({
  /** Needed when there is no showtime; with a showtime the start comes from it. */
  startAt: z.coerce.date().optional(),
  showtimeId: objectId.optional(),
});
export type OptionInput = z.infer<typeof optionInputSchema>;

export const createAppointmentSchema = z.object({
  movieId: objectId,
  options: z.array(optionInputSchema).min(1).max(MAX_TIME_OPTIONS),
  inviteeIds: z.array(objectId).min(1).max(MAX_INVITEES),
  responseDeadline: z.coerce.date().optional(),
  /** false keeps it as a draft (nobody is told yet). */
  send: z.boolean().default(true),
});
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;

export const proposeOptionSchema = optionInputSchema;

/** A person's whole answer, sent in one go: their vote on each time they changed (`null` takes it back), and times they suggest. */
export const submitResponseSchema = z.object({
  votes: z.array(z.object({ optionId: objectId, vote: z.enum(["yes", "no"]).nullable() })).max(MAX_TIME_OPTIONS),
  proposals: z.array(optionInputSchema).max(MAX_TIME_OPTIONS),
});
export type SubmitResponseInput = z.infer<typeof submitResponseSchema>;

export type AppointmentError =
  | "not_found"
  | "forbidden"
  | "bad_state"
  | "movie_not_found"
  | "invalid_option"
  | "not_friends"
  | "invalid_deadline"
  | "deadline_too_late"
  | "option_before_deadline"
  | "limit"
  | "duplicate"
  | "needs_attendee"
  | "late"
  | "deadline_passed"
  | "conflict";
/** Tells people about something that just happened. The movie and the actor's name are read here and stored with the notification. */
async function notifyPeople(
  appointmentId: string,
  actorId: string,
  type: NotificationType,
  recipientIds: string[],
  extra: Partial<NotificationPayload> = {},
): Promise<void> {
  const recipients = [...new Set(recipientIds)].filter((id) => id !== actorId);
  if (recipients.length === 0) return;
  const appointment = await Appointment.findById(appointmentId, "movieId").lean();
  const [movie, actor] = await Promise.all([
    appointment ? Movie.findById(appointment.movieId, "title").lean() : null,
    User.findById(actorId, "name").lean(),
  ]);
  const payload: NotificationPayload = { appointmentId, movieTitle: movie?.title ?? "", actorName: actor?.name ?? "", ...extra };
  await enqueueNotifications(recipients.map((recipientId) => ({ recipientId, type, payload })));
}

type Failure = { ok: false; error: AppointmentError };

const MAX_RETRIES = 4;

/** Loads, changes and saves one appointment. A stale save (someone else changed it meanwhile) is retried on fresh data. */
async function mutate<T extends { ok: boolean }>(id: string, change: (doc: Doc) => Promise<T> | T): Promise<T | Failure> {
  if (!isValidObjectId(id)) return { ok: false, error: "not_found" };
  await connectToDatabase();
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const doc = await Appointment.findById(id);
    if (!doc) return { ok: false, error: "not_found" };
    const result = await change(doc);
    if (!result.ok) return result;
    try {
      await doc.save();
      return result;
    } catch (error) {
      if (error instanceof MongooseError.VersionError) continue;
      throw error;
    }
  }
  return { ok: false, error: "conflict" };
}

/** True once the answer-by time has passed: from then on invited people cannot vote, suggest a time or turn the invitation down. */
const deadlinePassed = (doc: { responseDeadline?: Date | null }, now: Date): boolean => Boolean(doc.responseDeadline) && doc.responseDeadline!.getTime() <= now.getTime();

const sameId = (a: { toString(): string } | undefined | null, b: string) => a?.toString() === b;
/** Replaces one person's vote on an option (or removes it). The whole list is rewritten so the in-memory copy is always what gets saved. */
function setOptionVote(option: Doc["timeOptions"][number], userId: string, vote: "yes" | "no" | null): void {
  const others = option.votes.filter((v) => !sameId(v.userId, userId)).map((v) => ({ userId: v.userId, vote: v.vote }));
  option.set("votes", vote ? [...others, { userId, vote }] : others);
}
const participantOf = (doc: Doc, userId: string) => doc.participants.find((p) => sameId(p.userId, userId));

/** Turns a time option from the form into a real start time, checking it against the movie and the clock. */
async function resolveOption(movieId: string, input: OptionInput, now = new Date()): Promise<{ startAt: Date; showtimeId?: string } | null> {
  if (input.showtimeId) {
    const showtime = await Showtime.findOne({ _id: input.showtimeId, movieId }, "startAt").lean();
    if (!showtime || showtime.startAt.getTime() <= now.getTime()) return null;
    return { startAt: showtime.startAt, showtimeId: input.showtimeId };
  }
  if (!input.startAt || Number.isNaN(input.startAt.getTime()) || input.startAt.getTime() <= now.getTime()) return null;
  return { startAt: input.startAt };
}

export type CreateResult = { ok: true; id: string; status: AppointmentStatus } | Failure;

/** A new appointment: the creator picks the movie, one or more times, and friends to invite. Sent right away unless it is a draft. */
export async function createAppointment(creatorId: string, input: CreateAppointmentInput, now = new Date()): Promise<CreateResult> {
  await connectToDatabase();
  if (!(await Movie.exists({ _id: input.movieId }))) return { ok: false, error: "movie_not_found" };

  const inviteeIds = [...new Set(input.inviteeIds)];
  // Only current, active friends can be invited: that is also what keeps locked accounts out.
  if ((await filterFriendIds(creatorId, inviteeIds)).length !== inviteeIds.length) return { ok: false, error: "not_friends" };
  if (input.responseDeadline && input.responseDeadline.getTime() <= now.getTime()) return { ok: false, error: "invalid_deadline" };

  const options: { startAt: Date; showtimeId?: string }[] = [];
  for (const raw of input.options) {
    const option = await resolveOption(input.movieId, raw, now);
    if (!option) return { ok: false, error: "invalid_option" };
    const clash = options.some((o) => o.startAt.getTime() === option.startAt.getTime() && o.showtimeId === option.showtimeId);
    if (clash) return { ok: false, error: "duplicate" };
    options.push(option);
  }
  // The poll has to end before the first time on it: after that time nobody could go anyway.
  if (input.responseDeadline && input.responseDeadline.getTime() >= Math.min(...options.map((o) => o.startAt.getTime()))) return { ok: false, error: "deadline_too_late" };

  const doc = await Appointment.create({
    creatorId,
    movieId: input.movieId,
    status: input.send ? "INVITING" : "DRAFT",
    responseDeadline: input.responseDeadline,
    timeOptions: options.map((o) => ({ ...o, proposedBy: creatorId, votes: [] })),
    participants: inviteeIds.map((userId) => ({ userId, status: "invited" })),
  });
  if (input.send) await notifyPeople(doc._id.toString(), creatorId, "appointment_invited", inviteeIds);
  return { ok: true, id: doc._id.toString(), status: doc.status };
}

/** Sends a draft: DRAFT becomes INVITING and the invited people are told. */
export async function sendInvitations(creatorId: string, id: string): Promise<{ ok: true; recipientIds: string[] } | Failure> {
  const result = await mutate(id, (doc) => {
    if (!sameId(doc.creatorId, creatorId)) return { ok: false as const, error: "forbidden" as const };
    if (!canTransition(doc.status, "INVITING")) return { ok: false as const, error: "bad_state" as const };
    doc.status = "INVITING";
    return { ok: true as const, recipientIds: doc.participants.map((p) => p.userId.toString()) };
  });
  if (result.ok) await notifyPeople(id, creatorId, "appointment_invited", result.recipientIds);
  return result;
}

export const inviteMoreSchema = z.object({ inviteeIds: z.array(objectId).min(1).max(MAX_INVITEES) });

/**
 * The creator invites more friends while people can still answer (or while it is a draft). Only the new people are told; the ones
 * invited before get nothing. The list is still capped, and nobody already in the appointment (even someone who declined) is added again.
 */
export async function inviteMore(creatorId: string, id: string, inviteeIds: string[], now = new Date()): Promise<{ ok: true; addedIds: string[] } | Failure> {
  const wanted = [...new Set(inviteeIds)];
  if (wanted.length === 0) return { ok: false, error: "needs_attendee" };
  if (!isValidObjectId(id)) return { ok: false, error: "not_found" };
  await connectToDatabase();
  const existing = await Appointment.findById(id, "creatorId").lean();
  if (!existing) return { ok: false, error: "not_found" };
  if (!sameId(existing.creatorId, creatorId)) return { ok: false, error: "forbidden" };
  // Only current, active friends: the same rule as the first invitation.
  if ((await filterFriendIds(creatorId, wanted)).length !== wanted.length) return { ok: false, error: "not_friends" };

  const result = await mutate(id, (doc) => {
    if (!sameId(doc.creatorId, creatorId)) return { ok: false as const, error: "forbidden" as const };
    if (doc.status !== "DRAFT" && !isOpenForReplies(doc.status)) return { ok: false as const, error: "bad_state" as const };
    // Someone invited now would have no time left to answer.
    if (deadlinePassed(doc, now)) return { ok: false as const, error: "deadline_passed" as const };
    if (wanted.some((userId) => participantOf(doc, userId))) return { ok: false as const, error: "duplicate" as const };
    if (doc.participants.length + wanted.length > MAX_INVITEES) return { ok: false as const, error: "limit" as const };
    for (const userId of wanted) doc.participants.push({ userId, status: "invited" });
    return { ok: true as const, addedIds: wanted, wasDraft: doc.status === "DRAFT" };
  });
  // A draft has told nobody yet; everyone on it is told when it is sent.
  if (result.ok && !result.wasDraft) await notifyPeople(id, creatorId, "appointment_invited", result.addedIds);
  return result.ok ? { ok: true, addedIds: result.addedIds } : result;
}

/** The invited person turns the whole invitation down (optionally saying why). They can still change their mind by voting. */
export async function declineInvitation(userId: string, id: string, reason?: string, now = new Date()): Promise<{ ok: true; creatorId: string } | Failure> {
  const text = reason?.trim().slice(0, MAX_DECLINE_REASON) || undefined;
  const result = await mutate(id, (doc) => {
    const me = participantOf(doc, userId);
    if (!me) return { ok: false as const, error: "not_found" as const };
    if (!isOpenForReplies(doc.status)) return { ok: false as const, error: "bad_state" as const };
    if (deadlinePassed(doc, now)) return { ok: false as const, error: "deadline_passed" as const };
    me.status = "declined";
    me.declineReason = text;
    for (const option of doc.timeOptions) setOptionVote(option, userId, null);
    return { ok: true as const, creatorId: doc.creatorId.toString() };
  });
  if (result.ok) await notifyPeople(id, userId, "appointment_reply", [result.creatorId], { kind: "decline", reason: text });
  return result;
}

/** Votes yes or no on one time option (`null` takes the vote back). A yes anywhere means the person is in; no yes at all means undecided. */
export async function setVote(
  userId: string,
  id: string,
  optionId: string,
  vote: "yes" | "no" | null,
  now = new Date(),
): Promise<{ ok: true; creatorId: string; becameAccepted: boolean } | Failure> {
  const result = await mutate(id, (doc) => {
    const me = participantOf(doc, userId);
    if (!me) return { ok: false as const, error: "not_found" as const };
    if (!isOpenForReplies(doc.status)) return { ok: false as const, error: "bad_state" as const };
    if (deadlinePassed(doc, now)) return { ok: false as const, error: "deadline_passed" as const };
    const option = doc.timeOptions.find((o) => sameId(o._id, optionId));
    if (!option) return { ok: false as const, error: "invalid_option" as const };

    setOptionVote(option, userId, vote);
    const before = me.status;
    me.status = doc.timeOptions.some((o) => o.votes.some((v) => sameId(v.userId, userId) && v.vote === "yes")) ? "accepted" : "invited";
    if (before === "declined") me.declineReason = undefined;
    return { ok: true as const, creatorId: doc.creatorId.toString(), becameAccepted: before !== "accepted" && me.status === "accepted" };
  });
  // Only the moment a person goes from "not in" to "in" is news for the creator; changing votes afterwards is not.
  if (result.ok && result.becameAccepted) await notifyPeople(id, userId, "appointment_reply", [result.creatorId], { kind: "agree" });
  return result;
}

/** Suggests another time. It joins the poll, and the person who suggested it votes yes automatically. */
export async function proposeOption(
  userId: string,
  id: string,
  input: OptionInput,
  now = new Date(),
): Promise<{ ok: true; creatorId: string; optionId: string } | Failure> {
  const result = await mutate(id, async (doc) => {
    const me = participantOf(doc, userId);
    if (!me) return { ok: false as const, error: "not_found" as const };
    if (!isOpenForReplies(doc.status)) return { ok: false as const, error: "bad_state" as const };
    if (deadlinePassed(doc, now)) return { ok: false as const, error: "deadline_passed" as const };
    if (doc.timeOptions.length >= MAX_TIME_OPTIONS) return { ok: false as const, error: "limit" as const };
    const option = await resolveOption(doc.movieId.toString(), input, now);
    if (!option) return { ok: false as const, error: "invalid_option" as const };
    // A time that comes before the answer-by time would be over before people could vote on it.
    if (doc.responseDeadline && option.startAt.getTime() <= doc.responseDeadline.getTime()) return { ok: false as const, error: "option_before_deadline" as const };
    if (doc.timeOptions.some((o) => o.startAt.getTime() === option.startAt.getTime() && o.showtimeId?.toString() === option.showtimeId)) {
      return { ok: false as const, error: "duplicate" as const };
    }
    const added = doc.timeOptions[doc.timeOptions.push({ ...option, proposedBy: userId, votes: [{ userId, vote: "yes" }] }) - 1]!;
    me.status = "accepted";
    me.declineReason = undefined;
    return { ok: true as const, creatorId: doc.creatorId.toString(), optionId: added._id.toString() };
  });
  if (result.ok) await notifyPeople(id, userId, "appointment_reply", [result.creatorId], { kind: "propose" });
  return result;
}

/**
 * The person's whole answer in one save: all their votes and any times they suggest (each suggestion carries their yes). It is all or
 * nothing: if any part is refused (a time that has passed, a duplicate, past the limit, an unknown option) nothing is saved.
 * The creator hears about it once: "suggested another time" when there are suggestions, otherwise "agreed" the first time the person becomes a yes.
 */
export async function submitResponse(
  userId: string,
  id: string,
  input: SubmitResponseInput,
  now = new Date(),
): Promise<{ ok: true; creatorId: string; becameAccepted: boolean; proposedCount: number } | Failure> {
  const result = await mutate(id, async (doc) => {
    const me = participantOf(doc, userId);
    if (!me) return { ok: false as const, error: "not_found" as const };
    if (!isOpenForReplies(doc.status)) return { ok: false as const, error: "bad_state" as const };
    if (deadlinePassed(doc, now)) return { ok: false as const, error: "deadline_passed" as const };
    // Nothing to save is not an answer: it must not, for example, quietly bring back someone who had declined.
    if (input.votes.length === 0 && input.proposals.length === 0) return { ok: true as const, creatorId: doc.creatorId.toString(), becameAccepted: false, proposedCount: 0 };

    if (input.votes.some((v) => !doc.timeOptions.some((o) => sameId(o._id, v.optionId)))) return { ok: false as const, error: "invalid_option" as const };
    if (doc.timeOptions.length + input.proposals.length > MAX_TIME_OPTIONS) return { ok: false as const, error: "limit" as const };

    const added: { startAt: Date; showtimeId?: string }[] = [];
    for (const proposal of input.proposals) {
      const option = await resolveOption(doc.movieId.toString(), proposal, now);
      if (!option) return { ok: false as const, error: "invalid_option" as const };
      if (doc.responseDeadline && option.startAt.getTime() <= doc.responseDeadline.getTime()) return { ok: false as const, error: "option_before_deadline" as const };
      const same = (o: { startAt: Date; showtimeId?: { toString(): string } | string | null }) => o.startAt.getTime() === option.startAt.getTime() && (o.showtimeId?.toString() ?? undefined) === option.showtimeId;
      if (doc.timeOptions.some(same) || added.some(same)) return { ok: false as const, error: "duplicate" as const };
      added.push(option);
    }

    for (const v of input.votes) setOptionVote(doc.timeOptions.find((o) => sameId(o._id, v.optionId))!, userId, v.vote);
    for (const option of added) doc.timeOptions.push({ ...option, proposedBy: userId, votes: [{ userId, vote: "yes" }] });

    const before = me.status;
    me.status = doc.timeOptions.some((o) => o.votes.some((v) => sameId(v.userId, userId) && v.vote === "yes")) ? "accepted" : "invited";
    if (before === "declined") me.declineReason = undefined;
    return { ok: true as const, creatorId: doc.creatorId.toString(), becameAccepted: before !== "accepted" && me.status === "accepted", proposedCount: added.length };
  });
  if (result.ok) {
    if (result.proposedCount > 0) await notifyPeople(id, userId, "appointment_reply", [result.creatorId], { kind: "propose" });
    else if (result.becameAccepted) await notifyPeople(id, userId, "appointment_reply", [result.creatorId], { kind: "agree" });
  }
  return result;
}

export const lockSchema = z.object({
  optionId: objectId,
  attendeeIds: z.array(objectId).min(1).max(MAX_INVITEES),
});
export type LockInput = z.infer<typeof lockSchema>;

/**
 * The creator picks one time and the final list of people, and the list is locked: nobody is added or removed after this.
 * Anyone invited who has not turned the invitation down can be put in (even without a yes); everyone else not chosen is left out.
 */
export async function lockParticipants(
  creatorId: string,
  id: string,
  input: LockInput,
): Promise<{ ok: true; attendeeIds: string[]; excludedIds: string[] } | Failure> {
  const result = await mutate(id, (doc) => {
    if (!sameId(doc.creatorId, creatorId)) return { ok: false as const, error: "forbidden" as const };
    if (!canTransition(doc.status, "PARTICIPANTS_LOCKED")) return { ok: false as const, error: "bad_state" as const };
    const option = doc.timeOptions.find((o) => sameId(o._id, input.optionId));
    if (!option) return { ok: false as const, error: "invalid_option" as const };

    const chosen = new Set(input.attendeeIds);
    const eligible = doc.participants.filter((p) => p.status === "invited" || p.status === "accepted");
    const eligibleIds = new Set(eligible.map((p) => p.userId.toString()));
    // Declined people and strangers cannot be put in; an empty list is not a plan.
    if (chosen.size === 0 || [...chosen].some((userId) => !eligibleIds.has(userId))) return { ok: false as const, error: "needs_attendee" as const };

    const attendeeIds: string[] = [];
    const excludedIds: string[] = [];
    for (const p of eligible) {
      const inList = chosen.has(p.userId.toString());
      p.status = inList ? "accepted" : "excluded";
      (inList ? attendeeIds : excludedIds).push(p.userId.toString());
    }
    doc.chosenOptionId = option._id;
    doc.status = "PARTICIPANTS_LOCKED";
    return { ok: true as const, attendeeIds, excludedIds };
  });
  if (result.ok) {
    await notifyPeople(id, creatorId, "participants_locked", result.attendeeIds, { included: true });
    await notifyPeople(id, creatorId, "participants_locked", result.excludedIds, { included: false });
  }
  return result;
}

/** An attendee leaves on their own, until the showtime. The creator is told; seats and money are settled in Sprint 5A. */
export async function withdraw(userId: string, id: string, now = new Date()): Promise<{ ok: true; creatorId: string } | Failure> {
  const result = await mutate(id, (doc) => {
    const me = participantOf(doc, userId);
    if (!me || me.status !== "accepted") return { ok: false as const, error: "not_found" as const };
    if (!canWithdraw(doc.status)) return { ok: false as const, error: "bad_state" as const };
    const chosen = doc.timeOptions.find((o) => sameId(o._id, doc.chosenOptionId?.toString() ?? ""));
    if (chosen && chosen.startAt.getTime() <= now.getTime()) return { ok: false as const, error: "late" as const };
    me.status = "dropped";
    return { ok: true as const, creatorId: doc.creatorId.toString() };
  });
  if (result.ok) await notifyPeople(id, userId, "participant_withdrew", [result.creatorId]);
  return result;
}

/** Only the creator cancels, at any step before it is over. Everyone who has not turned it down is told. */
export async function cancelAppointment(creatorId: string, id: string, reason?: string): Promise<{ ok: true; recipientIds: string[]; wasDraft: boolean } | Failure> {
  const text = reason?.trim().slice(0, MAX_DECLINE_REASON) || undefined;
  const result = await mutate(id, (doc) => {
    if (!sameId(doc.creatorId, creatorId)) return { ok: false as const, error: "forbidden" as const };
    if (!canTransition(doc.status, "CANCELLED")) return { ok: false as const, error: "bad_state" as const };
    const wasDraft = doc.status === "DRAFT";
    doc.status = "CANCELLED";
    doc.cancelReason = text;
    const skip: ParticipantStatus[] = ["declined", "dropped", "excluded"];
    return { ok: true as const, wasDraft, recipientIds: wasDraft ? [] : doc.participants.filter((p) => !skip.includes(p.status)).map((p) => p.userId.toString()) };
  });
  if (result.ok) await notifyPeople(id, creatorId, "appointment_cancelled", result.recipientIds, { reason: text });
  return result;
}

// ---------- reading ----------

export interface OptionView {
  id: string;
  startAt: string;
  showtimeId?: string;
  /** "Branch · Room" of the showtime this time points at. */
  place?: string;
  proposedBy?: PersonView;
  votes: { userId: string; vote: "yes" | "no" }[];
  myVote?: "yes" | "no";
}

export interface ParticipantView extends PersonView {
  status: ParticipantStatus;
  overdue: boolean;
  declineReason?: string;
}

export interface AppointmentView {
  id: string;
  /** The person looking (the session's user): so their own draft vote can replace their saved one when counting. */
  viewerId: string;
  status: AppointmentStatus;
  isCreator: boolean;
  myStatus: ParticipantStatus | null;
  creator: PersonView;
  movie: { id: string; title: string; posterUrl?: string };
  responseDeadline: string | null;
  /** The answer-by time has passed: people can no longer reply (the creator can still lock). */
  deadlinePassed: boolean;
  options: OptionView[];
  chosenOptionId?: string;
  participants: ParticipantView[];
  cancelReason?: string;
}

async function loadPeople(ids: string[]): Promise<Map<string, PersonView>> {
  const users = await User.find({ _id: { $in: [...new Set(ids)] } }, "name avatar").lean();
  return new Map(users.map((u) => [u._id.toString(), { id: u._id.toString(), name: u.name, avatar: u.avatar ?? undefined }]));
}

/** "Branch · Room" for each showtime id. */
async function loadPlaces(showtimeIds: string[]): Promise<Map<string, string>> {
  if (showtimeIds.length === 0) return new Map();
  const showtimes = await Showtime.find({ _id: { $in: showtimeIds } }, "auditoriumId").lean();
  const rooms = await Auditorium.find({ _id: { $in: showtimes.map((s) => s.auditoriumId) } }, "name branchId").lean();
  const branches = await Branch.find({ _id: { $in: rooms.map((r) => r.branchId) } }, "name").lean();
  const branchName = new Map(branches.map((b) => [b._id.toString(), b.name]));
  const roomText = new Map(rooms.map((r) => [r._id.toString(), [branchName.get(r.branchId.toString()), r.name].filter(Boolean).join(" · ")]));
  return new Map(showtimes.map((s) => [s._id.toString(), roomText.get(s.auditoriumId.toString()) ?? ""]));
}

/** One appointment as the signed-in person may see it, or null when it does not exist or they are not part of it. */
export async function getAppointment(userId: string, id: string, now = new Date()): Promise<AppointmentView | null> {
  if (!isValidObjectId(id)) return null;
  await connectToDatabase();
  const doc = await Appointment.findById(id).lean();
  if (!doc) return null;
  const isCreator = doc.creatorId.toString() === userId;
  const me = doc.participants.find((p) => p.userId.toString() === userId);
  // A draft has not been sent: only its creator knows about it.
  if (!isCreator && (!me || doc.status === "DRAFT")) return null;

  const people = await loadPeople([doc.creatorId.toString(), ...doc.participants.map((p) => p.userId.toString()), ...doc.timeOptions.map((o) => o.proposedBy.toString())]);
  const movie = await Movie.findById(doc.movieId, "title posterUrl").lean();
  const places = await loadPlaces(doc.timeOptions.flatMap((o) => (o.showtimeId ? [o.showtimeId.toString()] : [])));
  const unknown = (pid: string): PersonView => ({ id: pid, name: "?" });
  const person = (pid: string) => people.get(pid) ?? unknown(pid);

  return {
    id: doc._id.toString(),
    viewerId: userId,
    status: doc.status,
    isCreator,
    myStatus: me?.status ?? null,
    creator: person(doc.creatorId.toString()),
    movie: { id: doc.movieId.toString(), title: movie?.title ?? "", posterUrl: movie?.posterUrl ?? undefined },
    responseDeadline: doc.responseDeadline?.toISOString() ?? null,
    deadlinePassed: deadlinePassed(doc, now),
    options: doc.timeOptions.map((o) => ({
      id: o._id.toString(),
      startAt: o.startAt.toISOString(),
      showtimeId: o.showtimeId?.toString(),
      place: o.showtimeId ? places.get(o.showtimeId.toString()) : undefined,
      proposedBy: o.proposedBy.toString() === doc.creatorId.toString() ? undefined : person(o.proposedBy.toString()),
      votes: o.votes.map((v) => ({ userId: v.userId.toString(), vote: v.vote })),
      myVote: o.votes.find((v) => v.userId.toString() === userId)?.vote,
    })),
    chosenOptionId: doc.chosenOptionId?.toString(),
    participants: doc.participants.map((p) => ({
      ...person(p.userId.toString()),
      status: p.status,
      overdue: isOverdue(doc.responseDeadline, p.status, now),
      declineReason: p.declineReason ?? undefined,
    })),
    cancelReason: doc.cancelReason ?? undefined,
  };
}

export interface AppointmentSummary {
  id: string;
  status: AppointmentStatus;
  isCreator: boolean;
  /** This person has not answered yet and the poll is open: shown as "needs your answer". */
  needsReply: boolean;
  creatorName: string;
  movie: { title: string; posterUrl?: string };
  /** The chosen time once locked, otherwise the earliest candidate. */
  startAt: string;
  optionCount: number;
  attendeeCount: number;
  /** Invited people, and how many of them have answered (said yes to a time, or declined): "2/3 answered" while inviting. */
  participantCount: number;
  answeredCount: number;
}

/** The signed-in person's appointments, split into current and finished (watched or cancelled). */
export async function listAppointments(userId: string): Promise<{ active: AppointmentSummary[]; past: AppointmentSummary[] }> {
  await connectToDatabase();
  const docs = await Appointment.find({
    $or: [{ creatorId: userId }, { "participants.userId": userId, status: { $ne: "DRAFT" } }],
  })
    .sort({ updatedAt: -1 })
    .limit(200)
    .lean();
  const movies = await Movie.find({ _id: { $in: [...new Set(docs.map((d) => d.movieId.toString()))] } }, "title posterUrl").lean();
  const movieById = new Map(movies.map((m) => [m._id.toString(), m]));
  const people = await loadPeople(docs.map((d) => d.creatorId.toString()));

  const summaries = docs.map((doc): AppointmentSummary => {
    const me = doc.participants.find((p) => p.userId.toString() === userId);
    const chosen = doc.timeOptions.find((o) => o._id.toString() === doc.chosenOptionId?.toString());
    const times = doc.timeOptions.map((o) => o.startAt.getTime());
    const movie = movieById.get(doc.movieId.toString());
    return {
      id: doc._id.toString(),
      status: doc.status,
      isCreator: doc.creatorId.toString() === userId,
      needsReply: doc.status === "INVITING" && me?.status === "invited",
      creatorName: people.get(doc.creatorId.toString())?.name ?? "",
      movie: { title: movie?.title ?? "", posterUrl: movie?.posterUrl ?? undefined },
      startAt: (chosen?.startAt ?? new Date(Math.min(...times))).toISOString(),
      optionCount: doc.timeOptions.length,
      attendeeCount: doc.participants.filter((p) => p.status === "accepted").length + 1,
      participantCount: doc.participants.length,
      answeredCount: doc.participants.filter((p) => p.status === "accepted" || p.status === "declined").length,
    };
  });
  const byTime = (a: AppointmentSummary, b: AppointmentSummary) => a.startAt.localeCompare(b.startAt);
  return {
    active: summaries.filter((s) => !isFinished(s.status)).sort(byTime),
    past: summaries.filter((s) => isFinished(s.status)).sort((a, b) => byTime(b, a)),
  };
}
