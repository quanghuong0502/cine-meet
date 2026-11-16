import { randomUUID } from "node:crypto";

/**
 * Development only. A tiny relay between the developer (curl, via /api/dev/agent/run) and a page open on a phone
 * (DevAgent component, long polling /api/dev/agent): the developer queues a piece of JavaScript, the phone runs it
 * and sends the result back. Kept on `globalThis` so a hot reload does not lose the queue.
 */

export interface AgentCommand {
  id: string;
  code: string;
}

export interface AgentResult {
  ok: boolean;
  result?: unknown;
  error?: string;
}

interface Store {
  queue: AgentCommand[];
  waiters: ((command: AgentCommand | null) => void)[];
  pending: Map<string, (result: AgentResult) => void>;
  lastSeen: number;
}

const initial: Store = { queue: [], waiters: [], pending: new Map(), lastSeen: 0 };
const store = ((globalThis as { __devAgent?: Store }).__devAgent ??= initial);

/** The phone has asked for work within this many ms: it is considered connected. */
const CONNECTED_WITHIN_MS = 25_000;

export function isDeviceConnected(): boolean {
  return Date.now() - store.lastSeen < CONNECTED_WITHIN_MS;
}

/** Phone side: wait up to `waitMs` for a command. Resolves with null when nothing came (or the phone went away). */
export function nextCommand(waitMs: number, signal: AbortSignal): Promise<AgentCommand | null> {
  store.lastSeen = Date.now();
  const queued = store.queue.shift();
  if (queued) return Promise.resolve(queued);

  return new Promise((resolve) => {
    const finish = (command: AgentCommand | null) => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      store.waiters = store.waiters.filter((waiter) => waiter !== finish);
      store.lastSeen = Date.now();
      resolve(command);
    };
    // A phone that reloaded (navigation) leaves a dead request behind: drop it so it cannot swallow a command.
    const onAbort = () => finish(null);
    const timer = setTimeout(() => finish(null), waitMs);
    signal.addEventListener("abort", onAbort);
    store.waiters.push(finish);
  });
}

/** Phone side: the outcome of a command. */
export function completeCommand(id: string, outcome: AgentResult): void {
  store.pending.get(id)?.(outcome);
  store.pending.delete(id);
}

/** Developer side: queue code for the phone and wait for what it returns. */
export function runOnDevice(code: string, timeoutMs: number): Promise<AgentResult> {
  if (!isDeviceConnected()) return Promise.resolve({ ok: false, error: "no device connected (open the app on the phone and turn the agent on)" });

  const command: AgentCommand = { id: randomUUID(), code };
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      store.pending.delete(command.id);
      resolve({ ok: false, error: `timed out after ${timeoutMs}ms` });
    }, timeoutMs);
    store.pending.set(command.id, (outcome) => {
      clearTimeout(timer);
      resolve(outcome);
    });
    const waiter = store.waiters[0];
    if (waiter) waiter(command);
    else store.queue.push(command);
  });
}
