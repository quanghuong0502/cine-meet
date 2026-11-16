import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { getActiveUser } from "@/lib/auth/guards";

/** Where the phone's measurements land, for whoever is developing (read from disk). Dev only: see /dev-audit. */
export const AUDIT_FILE = join(process.cwd(), ".next", "dev-audit.json");

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") return new NextResponse(null, { status: 404 });
  if (!(await getActiveUser())) return new NextResponse(null, { status: 401 });

  const body: unknown = await request.json();
  await mkdir(join(process.cwd(), ".next"), { recursive: true });
  await writeFile(AUDIT_FILE, JSON.stringify(body, null, 2));
  return NextResponse.json({ ok: true });
}
