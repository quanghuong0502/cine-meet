import { describe, expect, it } from "vitest";
import { oneSignalConfig, pushProvider, pushReady } from "./provider";

const env = (values: Record<string, string>) => values as unknown as NodeJS.ProcessEnv;

describe("pushProvider", () => {
  it("is Web Push unless PUSH_PROVIDER says onesignal", () => {
    expect(pushProvider(env({}))).toBe("webpush");
    expect(pushProvider(env({ PUSH_PROVIDER: "webpush" }))).toBe("webpush");
    expect(pushProvider(env({ PUSH_PROVIDER: "nonsense" }))).toBe("webpush");
    expect(pushProvider(env({ PUSH_PROVIDER: " OneSignal " }))).toBe("onesignal");
  });
});

describe("oneSignalConfig", () => {
  it("is null unless the app id and the REST key are both set", () => {
    expect(oneSignalConfig(env({}))).toBeNull();
    expect(oneSignalConfig(env({ ONESIGNAL_APP_ID: "app" }))).toBeNull();
    expect(oneSignalConfig(env({ ONESIGNAL_API_KEY: "key" }))).toBeNull();
    expect(oneSignalConfig(env({ ONESIGNAL_APP_ID: " app ", ONESIGNAL_API_KEY: " key " }))).toEqual({ appId: "app", apiKey: "key" });
  });
});

describe("pushReady", () => {
  it("asks the chosen provider for its own settings", () => {
    const onesignalOnly = { ONESIGNAL_APP_ID: "app", ONESIGNAL_API_KEY: "key" };
    expect(pushReady(env({ PUSH_PROVIDER: "onesignal", ...onesignalOnly }))).toBe(true);
    expect(pushReady(env({ PUSH_PROVIDER: "onesignal" }))).toBe(false);
    // Web Push with only OneSignal settings is not ready: the provider decides which keys count.
    expect(pushReady(env({ ...onesignalOnly }))).toBe(false);
  });
});
