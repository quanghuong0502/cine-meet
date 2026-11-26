/**
 * The OneSignal Web SDK (v16) in the browser, loaded only when PUSH_PROVIDER=onesignal and only on Settings
 * (and deferred until the user has granted permission, has existing devices, or taps to enable push).
 */

export interface OneSignalApi {
  init(options: Record<string, unknown>): Promise<void>;
  Notifications: {
    requestPermission(): Promise<void>;
  };
  User: {
    PushSubscription: {
      readonly id: string | null | undefined;
      readonly optedIn: boolean | undefined;
      optIn(): Promise<void>;
      optOut(): Promise<void>;
    };
  };
}

declare global {
  interface Window {
    OneSignalDeferred?: Array<(oneSignal: OneSignalApi) => void | Promise<void>>;
  }
}

const SDK_URL = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
const WORKER_PATH = "push/onesignal/OneSignalSDKWorker.js";
const WORKER_SCOPE = "/push/onesignal/";

let loading: Promise<OneSignalApi> | null = null;

/** Loads and starts the SDK once; cleans up failed script/callback on retry so `init()` is never called twice. */
export function loadOneSignal(appId: string): Promise<OneSignalApi> {
  if (loading) return loading;
  const started = new Promise<OneSignalApi>((resolve, reject) => {
    window.OneSignalDeferred = window.OneSignalDeferred ?? [];
    const callback = async (oneSignal: OneSignalApi) => {
      try {
        await oneSignal.init({
          appId,
          serviceWorkerPath: WORKER_PATH,
          serviceWorkerParam: { scope: WORKER_SCOPE },
          notifyButton: { enable: false },
          welcomeNotification: { disable: true },
          ...(process.env.NODE_ENV !== "production" ? { allowLocalhostAsSecureOrigin: true } : {}),
        });
        resolve(oneSignal);
      } catch (error) {
        reject(error);
      }
    };
    window.OneSignalDeferred.push(callback);
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    script.onerror = () => {
      script.remove();
      const idx = window.OneSignalDeferred?.indexOf(callback) ?? -1;
      if (idx >= 0) window.OneSignalDeferred?.splice(idx, 1);
      reject(new Error("onesignal_script"));
    };
    document.head.appendChild(script);
  });
  loading = started.catch((error) => {
    loading = null;
    throw error;
  });
  return loading;
}

/** Waits (up to `timeoutMs`) for the device's subscription id: it arrives a moment after the person opts in. */
export async function waitForSubscriptionId(oneSignal: OneSignalApi, timeoutMs = 10_000): Promise<string | null> {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const id = oneSignal.User.PushSubscription.id;
    if (id) return id;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return null;
}
