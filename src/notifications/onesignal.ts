import { oneSignalConfig } from "./provider";
import type { PushPayload } from "./push";

/**
 * The call form is the one already running in production on another project of the owner (the v1 endpoint, `Basic` with the REST key,
 * `include_subscription_ids`). Check it against OneSignal's current docs before changing it.
 */
const API = "https://onesignal.com/api/v1/notifications";

export interface OneSignalSendOptions {
  /** How long OneSignal keeps the message for a phone that is offline, in seconds. */
  ttlSeconds: number;
  /** Hold the message until this time (OneSignal's `send_after`, up to 30 days ahead). Left out: send now. */
  sendAfter?: Date;
}

/**
 * The result of one call. `id` is the message's id at OneSignal (what a later cancel needs). `invalidIds` are subscription ids OneSignal says
 * it cannot deliver to any more (unsubscribed or unknown): the device rows behind them should go, like a Web Push 404 or 410.
 * `retry` tells a temporary failure (network, rate limit, server error) from one that will not get better by trying again.
 */
export type OneSignalResult =
  | { status: "ok"; id: string; invalidIds: string[] }
  | { status: "error"; message: string; invalidIds: string[]; retry: boolean };

export type OneSignalSender = (subscriptionIds: string[], payload: PushPayload, options: OneSignalSendOptions) => Promise<OneSignalResult>;

/** Every string OneSignal lists under an "invalid..." key of its `errors` (the key name has changed between API versions). */
function invalidIdsOf(errors: unknown, asked: string[]): string[] {
  if (Array.isArray(errors)) {
    // Older form: a list of sentences. "All included players are not subscribed" means every id asked for is dead.
    return errors.some((e) => typeof e === "string" && /not subscribed/i.test(e)) ? asked : [];
  }
  if (!errors || typeof errors !== "object") return [];
  const found: string[] = [];
  for (const [key, value] of Object.entries(errors)) {
    if (/invalid/i.test(key) && Array.isArray(value)) found.push(...value.filter((v): v is string => typeof v === "string"));
  }
  return found.filter((id) => asked.includes(id));
}

function headers(apiKey: string): Record<string, string> {
  return { "Content-Type": "application/json", Authorization: `Basic ${apiKey}` };
}

/** Sends (or schedules, with `sendAfter`) one message to these devices through OneSignal. */
export const sendOneSignal: OneSignalSender = async (subscriptionIds, payload, options) => {
  const config = oneSignalConfig();
  if (!config) return { status: "error", message: "not_configured", invalidIds: [], retry: false };
  if (subscriptionIds.length === 0) return { status: "error", message: "no_devices", invalidIds: [], retry: false };
  try {
    const response = await fetch(API, {
      method: "POST",
      headers: headers(config.apiKey),
      body: JSON.stringify({
        app_id: config.appId,
        target_channel: "push",
        include_subscription_ids: subscriptionIds,
        // The words are already in the person's language (and pronouns): one language key, so OneSignal shows exactly this.
        headings: { en: payload.title },
        contents: { en: payload.body },
        url: payload.url,
        // A newer push with the same topic replaces the older one on the phone (the same job as `tag` in the service worker).
        web_push_topic: payload.url.slice(0, 64),
        ttl: options.ttlSeconds,
        priority: 10,
        ...(options.sendAfter ? { send_after: options.sendAfter.toISOString() } : {}),
      }),
    });
    const body = (await response.json().catch(() => null)) as { id?: unknown; errors?: unknown } | null;
    const invalidIds = invalidIdsOf(body?.errors, subscriptionIds);
    const id = typeof body?.id === "string" ? body.id : "";
    if (response.ok && id) return { status: "ok", id, invalidIds };
    // Nobody left to send to: not a failure worth retrying.
    if (invalidIds.length >= subscriptionIds.length) return { status: "ok", id, invalidIds };
    const retry = response.status === 429 || response.status >= 500;
    return { status: "error", message: `http_${response.status}`, invalidIds, retry };
  } catch {
    // No network: the message itself is never written down, only that it did not go.
    return { status: "error", message: "network", invalidIds: [], retry: true };
  }
};

/** Takes back a message that was scheduled (or is still going out). Only devices not yet queued are spared it. `true` when it is gone or never existed. */
export async function cancelOneSignal(messageId: string): Promise<boolean> {
  const config = oneSignalConfig();
  if (!config) return false;
  try {
    const response = await fetch(`${API}/${encodeURIComponent(messageId)}?app_id=${encodeURIComponent(config.appId)}`, {
      method: "DELETE",
      headers: headers(config.apiKey),
    });
    // 404: already sent or cancelled, nothing left to take back.
    return response.ok || response.status === 404;
  } catch {
    return false;
  }
}
