"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/guards";
import {
  deleteGroup,
  groupInputSchema,
  removeFriendship,
  requestByInviteCode,
  requestByPhone,
  respondToRequest,
  saveGroup,
  type PhoneRequestResult,
  type RequestResult,
  type RespondResult,
  type SaveGroupResult,
} from "@/services/friend.service";

// Every action takes the person from the session; nothing about who is asking comes from the request.

export async function sendFriendRequestAction(phone: string): Promise<PhoneRequestResult> {
  const user = await requireUser();
  const result = await requestByPhone(user.userId, typeof phone === "string" ? phone : "");
  if (result.ok) revalidatePath("/friends", "layout");
  return result;
}

export async function sendInviteRequestAction(code: string): Promise<RequestResult> {
  const user = await requireUser();
  const result = await requestByInviteCode(user.userId, typeof code === "string" ? code : "");
  if (result.ok) revalidatePath("/friends", "layout");
  return result;
}

export async function respondRequestAction(friendshipId: string, accept: boolean): Promise<RespondResult> {
  const user = await requireUser();
  const result = await respondToRequest(user.userId, friendshipId, accept === true);
  if (result.ok) revalidatePath("/friends", "layout");
  return result;
}

export async function removeFriendAction(otherId: string): Promise<RespondResult> {
  const user = await requireUser();
  const result = await removeFriendship(user.userId, otherId);
  if (result.ok) revalidatePath("/friends", "layout");
  return result;
}

export async function saveGroupAction(input: unknown): Promise<SaveGroupResult | { ok: false; error: "validation" }> {
  const user = await requireUser();
  const parsed = groupInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const result = await saveGroup(user.userId, parsed.data);
  if (result.ok) revalidatePath("/friends", "layout");
  return result;
}

export async function deleteGroupAction(groupId: string): Promise<SaveGroupResult> {
  const user = await requireUser();
  const result = await deleteGroup(user.userId, groupId);
  if (result.ok) revalidatePath("/friends", "layout");
  return result;
}
