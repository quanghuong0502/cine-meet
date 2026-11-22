/**
 * The OneSignal Web SDK (v16) in the browser, loaded only when the server says PUSH_PROVIDER=onesignal and only on the page that needs it
 * (Settings): it is a script from OneSignal's own address, so no other page pays for it. Everything here runs after a tap or after the
 * page has loaded; nothing asks for notification permission by itself.
 */

/** The part of the SDK the app uses. */
export interface OneSignalApi {
  init(options: Record<string, unknown>): Promise<void>;
  Notifications: {
    /** Asks the browser for permission. Only ever called from a tap. */
    requestPermission(): Promise<void>;
  };
  User: {
    PushSubscription: {
      /** OneSignal's id for this device's subscription (what the server stores); empty until the device has subscribed. */
      readonly id: string | null | undefined;
      /** True when this device is subscribed and has not opted out. */
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
/**
 * OneSignal's own service worker lives in a folder of its own, with its own scope, so it never takes the place of `public/sw.js`
 * (the offline page and cache): a scope holds one worker, and two push handlers in one worker would answer the same message twice.
 */
const WORKER_PATH = "push/onesignal/OneSignalSDKWorker.js";
const WORKER_SCOPE = "/push/onesignal/";

let loading: Promise<OneSignalApi> | null = null;

/** Loads and starts the SDK once; every later call gets the same instance. Rejects when the script cannot be loaded (offline, blocked). */
export function loadOneSignal(appId: string): Promise<OneSignalApi> {
  if (loading) return loading;
  const started = new Promise<OneSignalApi>((resolve, reject) => {
    window.OneSignalDeferred = window.OneSignalDeferred ?? [];
    window.OneSignalDeferred.push(async (oneSignal) => {
      try {
        await oneSignal.init({
          appId,
          serviceWorkerPath: WORKER_PATH,
          serviceWorkerParam: { scope: WORKER_SCOPE },
          // The app has its own button and asks only when it is tapped; no bell and no welcome message of OneSignal's.
          notifyButton: { enable: false },
          welcomeNotification: { disable: true },
          // Lets the SDK run on http://localhost while developing (a real address must be https).
          allowLocalhostAsSecureOrigin: true,
        });
        resolve(oneSignal);
      } catch (error) {
        reject(error);
      }
    });
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.defer = true;
    script.onerror = () => reject(new Error("onesignal_script"));
    document.head.appendChild(script);
  });
  // A failed load can be tried again by the next call (the network may be back).
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
