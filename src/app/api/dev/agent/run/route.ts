import { readFile } from "node:fs/promises";
import { timingSafeEqual } from "node:crypto";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { runOnDevice } from "@/lib/dev-agent";

/**
 * Developer side of the dev agent: `POST { code, timeoutMs? }` with the secret in `x-dev-agent-token`
 * (the contents of `.next/dev-agent-token`, created by hand, never committed). Runs the code on the phone and returns its result.
 * Dev only, local requests only; it is let through the sign-in check in src/auth.config.ts for that reason.
 */
const TOKEN_FILE = join(process.cwd(), ".next", "dev-agent-token");
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") return new NextResponse(null, { status: 404 });
  // The Host header (request.url is normalised to the server's own name): a request that came in by the LAN address is not ours.
  const host = (request.headers.get("host") ?? "").replace(/:\d+$/, "");
  if (!LOCAL_HOSTS.has(host)) return new NextResponse(null, { status: 403 });

  const expected = await readFile(TOKEN_FILE, "utf8").then((text) => text.trim(), () => "");
  const given = request.headers.get("x-dev-agent-token") ?? "";
  const valid = expected.length >= 32 && given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!valid) return new NextResponse(null, { status: 401 });

  const { code, timeoutMs } = (await request.json()) as { code?: string; timeoutMs?: number };
  if (typeof code !== "string" || !code.trim()) return NextResponse.json({ ok: false, error: "code is required" }, { status: 400 });
  const outcome = await runOnDevice(code, Math.min(Math.max(timeoutMs ?? 15_000, 1_000), 60_000));
  return NextResponse.json(outcome);
}
