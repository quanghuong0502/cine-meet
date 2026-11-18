import { sendNotification } from "web-push";

/** What a pushed message carries: short, the details are in the app. */
export interface PushPayload {
  title: string;
  body: string;
  /** App path opened when the person taps it. */
  url: string;
}

export interface PushTarget {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** The result of one try on one device. `gone` means the browser says this subscription no longer exists (404 or 410). */
export type PushOutcome = { status: "ok" } | { status: "gone" } | { status: "error"; message: string };

export type PushSender = (target: PushTarget, payload: PushPayload) => Promise<PushOutcome>;

/** The VAPID key pair and contact live in environment variables (never in code or the database). Missing any of them means push is off. */
export function pushConfig(): { publicKey: string; privateKey: string; subject: string } | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  return publicKey && privateKey && subject ? { publicKey, privateKey, subject } : null;
}

/** Sends one push with the `web-push` library, turning its errors into outcomes. */
export const sendWebPush: PushSender = async (target, payload) => {
  const config = pushConfig();
  if (!config) return { status: "error", message: "not_configured" };
  try {
    await sendNotification(target, JSON.stringify(payload), {
      vapidDetails: config,
      TTL: 60 * 60 * 24,
      // Time-sensitive: an invitation is worth little a day later, and a pushed "leaving now" even less.
      urgency: "high",
    });
    return { status: "ok" };
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return { status: "gone" };
    // Only the status goes on record: the error text can carry the device's endpoint address.
    return { status: "error", message: status ? `http_${status}` : "network" };
  }
};
