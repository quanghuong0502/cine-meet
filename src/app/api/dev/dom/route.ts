import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { getActiveUser } from "@/lib/auth/guards";

/**
 * Development only. Receives what the on-page recorder (src/components/dev/dom-recorder.tsx) saw and keeps it in
 * `.next/dev-dom.json` for whoever is developing: the latest outline of the page, and the last changes.
 */
export const DOM_FILE = join(process.cwd(), ".next", "dev-dom.json");
const KEEP_BATCHES = 40;

interface Batch {
  at: string;
  path: string;
  changes: string[];
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") return new NextResponse(null, { status: 404 });
  if (!(await getActiveUser())) return new NextResponse(null, { status: 401 });

  const body = (await request.json()) as { at: string; reset?: boolean; path: string; userAgent: string; window: unknown; snapshot: string; audit: unknown; changes: string[] };
  // `reset`: the app was restarted (or the recorder switched on again), so what is on disk is from an old run.
  const previous = body.reset ? {} as { history?: Batch[] } : await readFile(DOM_FILE, "utf8").then((text) => JSON.parse(text) as { history?: Batch[] }, () => ({}) as { history?: Batch[] });

  const history = [...(previous.history ?? []), { at: body.at, path: body.path, changes: body.changes }].slice(-KEEP_BATCHES);
  await mkdir(join(process.cwd(), ".next"), { recursive: true });
  await writeFile(
    DOM_FILE,
    JSON.stringify({ at: body.at, path: body.path, userAgent: body.userAgent, window: body.window, audit: body.audit, history, snapshot: body.snapshot }, null, 2),
  );
  return NextResponse.json({ ok: true });
}
