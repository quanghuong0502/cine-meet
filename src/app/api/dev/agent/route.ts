import { NextResponse } from "next/server";
import { getActiveUser } from "@/lib/auth/guards";
import { completeCommand, nextCommand } from "@/lib/dev-agent";

/** Phone side of the dev agent (docs: src/lib/dev-agent.ts). Dev only, signed-in users only. */
async function guard(): Promise<NextResponse | null> {
  if (process.env.NODE_ENV === "production") return new NextResponse(null, { status: 404 });
  if (!(await getActiveUser())) return new NextResponse(null, { status: 401 });
  return null;
}

/** Long poll: answers with the next command, or `{}` after ~20 seconds of nothing. */
export async function GET(request: Request) {
  const blocked = await guard();
  if (blocked) return blocked;
  const command = await nextCommand(20_000, request.signal);
  return NextResponse.json(command ?? {});
}

export async function POST(request: Request) {
  const blocked = await guard();
  if (blocked) return blocked;
  const body = (await request.json()) as { id?: string; ok?: boolean; result?: unknown; error?: string };
  if (typeof body.id === "string") completeCommand(body.id, { ok: body.ok === true, result: body.result, error: body.error });
  return NextResponse.json({ ok: true });
}
