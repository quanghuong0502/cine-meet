import { pushConfig } from "./push";

/**
 * Who delivers pushes. `webpush` is the app's own sender (the `web-push` library and VAPID keys, the default); `onesignal` hands them to
 * OneSignal. Only one runs at a time, chosen by PUSH_PROVIDER, so going back is a change of one variable, not of code.
 */
export type PushProvider = "webpush" | "onesignal";

export function pushProvider(env: NodeJS.ProcessEnv = process.env): PushProvider {
  return env.PUSH_PROVIDER?.trim().toLowerCase() === "onesignal" ? "onesignal" : "webpush";
}

export interface OneSignalConfig {
  appId: string;
  /** The REST API key: server only, never sent to the browser. */
  apiKey: string;
}

/** The OneSignal app and REST key live in environment variables. Missing either one means OneSignal push is off. */
export function oneSignalConfig(env: NodeJS.ProcessEnv = process.env): OneSignalConfig | null {
  const appId = env.ONESIGNAL_APP_ID?.trim();
  const apiKey = env.ONESIGNAL_API_KEY?.trim();
  return appId && apiKey ? { appId, apiKey } : null;
}

/** True when the chosen provider has everything it needs to send. */
export function pushReady(env: NodeJS.ProcessEnv = process.env): boolean {
  return pushProvider(env) === "onesignal" ? oneSignalConfig(env) !== null : pushConfig() !== null;
}
