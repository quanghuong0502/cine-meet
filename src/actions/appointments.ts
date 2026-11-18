"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
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
