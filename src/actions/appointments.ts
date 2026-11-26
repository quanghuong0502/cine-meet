"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import {
  assignSeats,
  assignSeatsSchema,
  beginPlanning,
  chooseShowtime,
  completeAppointment,
  confirmAppointment,
  confirmPlan,
  confirmPlanSchema,
  getPlanData,
  personCostSchema,
  setFood,
  setFoodSchema,
  setPersonCost,
} from "@/services/appointment-plan.service";
import type { PlanData } from "@/services/appointment-plan.service";
import { searchShowtimesFrom, type ShowtimeRow } from "@/services/showtime.service";
import {
  cancelAppointment,
  createAppointment,
  createAppointmentSchema,
  declineInvitation,
  inviteMore,
  inviteMoreSchema,
  lockParticipants,
  lockSchema,
  proposeOption,
  remindVoters,
  proposeOptionSchema,
  setVote,
  submitResponse,
  submitResponseSchema,
  withdraw,
  type AppointmentError,
} from "@/services/appointment.service";

// The person always comes from the session. Results are plain codes the interface translates.
export type ActionResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: AppointmentError | "validation" };

const idSchema = z.string().regex(/^[0-9a-fA-F]{24}$/);
const reasonSchema = z.string().max(500).optional();

function refresh(id?: string) {
  revalidatePath("/appointments", "layout");
  if (id) revalidatePath(`/appointments/${id}`);
}

export async function createAppointmentAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = createAppointmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const result = await createAppointment(user.userId, parsed.data);
  if (result.ok) refresh();
  return result.ok ? { ok: true, id: result.id } : result;
}

export async function declineInvitationAction(id: string, reason?: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success || !reasonSchema.safeParse(reason).success) return { ok: false, error: "validation" };
  const result = await declineInvitation(user.userId, id, reason);
  if (result.ok) refresh(id);
  return result.ok ? { ok: true } : result;
}

export async function setVoteAction(id: string, optionId: string, vote: "yes" | "no" | null): Promise<ActionResult> {
  const user = await requireUser();
  const valid = idSchema.safeParse(id).success && idSchema.safeParse(optionId).success && (vote === null || vote === "yes" || vote === "no");
  if (!valid) return { ok: false, error: "validation" };
  const result = await setVote(user.userId, id, optionId, vote);
  if (result.ok) refresh(id);
  return result.ok ? { ok: true } : result;
}

export async function proposeOptionAction(id: string, input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = proposeOptionSchema.safeParse(input);
  if (!idSchema.safeParse(id).success || !parsed.success) return { ok: false, error: "validation" };
  const result = await proposeOption(user.userId, id, parsed.data);
  if (result.ok) refresh(id);
  return result.ok ? { ok: true } : result;
}

export async function lockParticipantsAction(id: string, input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = lockSchema.safeParse(input);
  if (!idSchema.safeParse(id).success || !parsed.success) return { ok: false, error: "validation" };
  const result = await lockParticipants(user.userId, id, parsed.data);
  if (result.ok) refresh(id);
  return result.ok ? { ok: true } : result;
}

export async function withdrawAction(id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success) return { ok: false, error: "validation" };
  const result = await withdraw(user.userId, id);
  if (result.ok) refresh(id);
  return result.ok ? { ok: true } : result;
}

export async function cancelAppointmentAction(id: string, reason?: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success || !reasonSchema.safeParse(reason).success) return { ok: false, error: "validation" };
  const result = await cancelAppointment(user.userId, id, reason);
  if (result.ok) refresh(id);
  return result.ok ? { ok: true } : result;
}

export async function inviteMoreAction(id: string, input: unknown): Promise<ActionResult<{ count: number }>> {
  const user = await requireUser();
  const parsed = inviteMoreSchema.safeParse(input);
  if (!idSchema.safeParse(id).success || !parsed.success) return { ok: false, error: "validation" };
  const result = await inviteMore(user.userId, id, parsed.data.inviteeIds);
  if (result.ok) refresh(id);
  return result.ok ? { ok: true, count: result.addedIds.length } : result;
}

/** All of a person's answers in one save (see `submitResponse`). */
export async function submitResponseAction(id: string, input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = submitResponseSchema.safeParse(input);
  if (!idSchema.safeParse(id).success || !parsed.success) return { ok: false, error: "validation" };
  const result = await submitResponse(user.userId, id, parsed.data);
  if (result.ok) refresh(id);
  return result.ok ? { ok: true } : result;
}

/** The creator nudges people who have not voted on a time; `count` is how many were told. */
export async function remindVotersAction(id: string, optionId: string): Promise<ActionResult<{ count: number }>> {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success || !idSchema.safeParse(optionId).success) return { ok: false, error: "validation" };
  const result = await remindVoters(user.userId, id, optionId);
  if (result.ok) refresh(id);
  return result.ok ? { ok: true, count: result.recipientIds.length } : result;
}

// ---------- stage 2 (Sprint 5A) ----------

export async function beginPlanningAction(id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success) return { ok: false, error: "validation" };
  const result = await beginPlanning(user.userId, id);
  if (result.ok) refresh(id);
  return result.ok ? { ok: true } : result;
}

export async function chooseShowtimeAction(id: string, showtimeId: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success || !idSchema.safeParse(showtimeId).success) return { ok: false, error: "validation" };
  const result = await chooseShowtime(user.userId, id, showtimeId);
  if (result.ok) refresh(id);
  return result.ok ? { ok: true } : result;
}

export async function assignSeatsAction(id: string, input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = assignSeatsSchema.safeParse(input);
  if (!idSchema.safeParse(id).success || !parsed.success) return { ok: false, error: "validation" };
  const result = await assignSeats(user.userId, id, parsed.data);
  if (result.ok) refresh(id);
  return result.ok ? { ok: true } : result;
}

export async function setFoodAction(id: string, input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = setFoodSchema.safeParse(input);
  if (!idSchema.safeParse(id).success || !parsed.success) return { ok: false, error: "validation" };
  const result = await setFood(user.userId, id, parsed.data);
  if (result.ok) refresh(id);
  return result.ok ? { ok: true } : result;
}

export async function confirmAppointmentAction(id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success) return { ok: false, error: "validation" };
  const result = await confirmAppointment(user.userId, id);
  if (result.ok) refresh(id);
  return result.ok ? { ok: true } : result;
}

export async function completeAppointmentAction(id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success) return { ok: false, error: "validation" };
  const result = await completeAppointment(user.userId, id);
  if (result.ok) {
    refresh(id);
    revalidatePath("/");
  }
  return result.ok ? { ok: true } : result;
}

export async function setPersonCostAction(id: string, input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = personCostSchema.safeParse(input);
  if (!idSchema.safeParse(id).success || !parsed.success) return { ok: false, error: "invalid_amount" };
  const result = await setPersonCost(user.userId, id, parsed.data);
  if (result.ok) {
    refresh(id);
    revalidatePath("/");
  }
  return result.ok ? { ok: true } : result;
}

/** The showtimes of a movie on the day of the typed time, from that time on: what the person can pick when creating an appointment. */
export async function findShowtimesFromAction(movieId: string, startAt: string): Promise<{ ok: true; showtimes: ShowtimeRow[] } | { ok: false; error: "validation" }> {
  await requireUser();
  const when = new Date(startAt);
  if (!idSchema.safeParse(movieId).success || Number.isNaN(when.getTime())) return { ok: false, error: "validation" };
  return { ok: true, showtimes: await searchShowtimesFrom(movieId, when) };
}

/** The room and food of a showtime the creator is trying (not saved yet): read only, nothing is written. */
export async function loadPlanRoomAction(id: string, showtimeId: string): Promise<ActionResult<{ room?: PlanData["room"]; food: PlanData["food"] }>> {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success || !idSchema.safeParse(showtimeId).success) return { ok: false, error: "validation" };
  const data = await getPlanData(user.userId, id, showtimeId);
  if (!data) return { ok: false, error: "no_showtime" };
  return { ok: true, room: data.room, food: data.food };
}

/** Saves showtime, seats and food together, then confirms the plan. */
export async function confirmPlanAction(id: string, input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = confirmPlanSchema.safeParse(input);
  if (!idSchema.safeParse(id).success || !parsed.success) return { ok: false, error: "validation" };
  const result = await confirmPlan(user.userId, id, parsed.data);
  refresh(id);
  return result.ok ? { ok: true } : result;
}
