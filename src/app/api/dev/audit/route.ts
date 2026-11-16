import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { getActiveUser } from "@/lib/auth/guards";

/** Where the phone's measurements land, for whoever is developing (read from disk). Dev only: see /dev-audit. */
export const AUDIT_FILE = join(process.cwd(), ".next", "dev-audit.json");

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") return new NextResponse(null, { status: 404 });
  if (!(await getActiveUser())) return new NextResponse(null, { status: 401 });

  const body = (await request.json()) as { report?: { route: string }; reports?: unknown[] };
  await mkdir(join(process.cwd(), ".next"), { recursive: true });

  let result: unknown = body;
  if (body.report) {
    // One page measured by the on-screen button: keep what was measured before, replacing the same page.
    const previous = await readFile(AUDIT_FILE, "utf8").then((text) => JSON.parse(text) as { reports?: { route: string }[] }, () => ({}) as { reports?: { route: string }[] });
    const others = (previous.reports ?? []).filter((report) => report.route !== body.report?.route);
    result = { ...body, reports: [...others, body.report], report: undefined };
  }
  await writeFile(AUDIT_FILE, JSON.stringify(result, null, 2));
  return NextResponse.json({ ok: true });
}
