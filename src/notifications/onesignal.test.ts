import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cancelOneSignal, sendOneSignal } from "./onesignal";

const IDS = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"];
const PAYLOAD = { title: "Có kèo mới", body: "An mời bạn xem Phim", url: "/appointments/a1" };

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal("fetch", fn);
  return fn;
}
const sentBody = (fn: ReturnType<typeof mockFetch>) => JSON.parse((fn.mock.calls[0] as unknown as [string, { body: string }])[1].body) as Record<string, unknown>;

beforeEach(() => {
  vi.stubEnv("ONESIGNAL_APP_ID", "app-1");
  vi.stubEnv("ONESIGNAL_API_KEY", "key-1");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("sendOneSignal", () => {
  it("sends the words as they are to the given devices, with the REST key only in the header", async () => {
    const fetchMock = mockFetch(200, { id: "msg-1" });
    const result = await sendOneSignal(IDS, PAYLOAD, { ttlSeconds: 3600 });
    expect(result).toEqual({ status: "ok", id: "msg-1", invalidIds: [] });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, { method: string; headers: Record<string, string>; body: string }];
    expect(url).toBe("https://onesignal.com/api/v1/notifications");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Basic key-1");
    expect(init.body).not.toContain("key-1");
    expect(sentBody(fetchMock)).toMatchObject({
      app_id: "app-1",
      include_subscription_ids: IDS,
      headings: { en: PAYLOAD.title },
      contents: { en: PAYLOAD.body },
      url: PAYLOAD.url,
      ttl: 3600,
    });
    expect(sentBody(fetchMock)).not.toHaveProperty("send_after");
  });

  it("holds the message until the time given (send_after)", async () => {
    const fetchMock = mockFetch(200, { id: "msg-2" });
    await sendOneSignal(IDS, PAYLOAD, { ttlSeconds: 60, sendAfter: new Date("2026-12-01T10:30:00Z") });
    expect(sentBody(fetchMock).send_after).toBe("2026-12-01T10:30:00.000Z");
  });

  it("reports ids OneSignal cannot deliver to, under whichever invalid... key it uses", async () => {
    mockFetch(200, { id: "msg-3", errors: { invalid_player_ids: [IDS[1]], other: ["x"] } });
    expect(await sendOneSignal(IDS, PAYLOAD, { ttlSeconds: 60 })).toEqual({ status: "ok", id: "msg-3", invalidIds: [IDS[1]] });
  });

  it("treats 'nobody is subscribed' as done, with every id dead, not as a failure to retry", async () => {
    mockFetch(200, { id: "", errors: ["All included players are not subscribed"] });
    expect(await sendOneSignal(IDS, PAYLOAD, { ttlSeconds: 60 })).toEqual({ status: "ok", id: "", invalidIds: IDS });
  });

  it("marks a rate limit or a server error as worth retrying, and a plain refusal as not", async () => {
    mockFetch(429, { errors: ["slow down"] });
    expect(await sendOneSignal(IDS, PAYLOAD, { ttlSeconds: 60 })).toMatchObject({ status: "error", message: "http_429", retry: true });
    mockFetch(503, {});
    expect(await sendOneSignal(IDS, PAYLOAD, { ttlSeconds: 60 })).toMatchObject({ status: "error", message: "http_503", retry: true });
    mockFetch(400, { errors: ["bad request"] });
    expect(await sendOneSignal(IDS, PAYLOAD, { ttlSeconds: 60 })).toMatchObject({ status: "error", message: "http_400", retry: false });
  });

  it("retries a network failure without writing the message anywhere", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline: " + PAYLOAD.body))));
    const result = await sendOneSignal(IDS, PAYLOAD, { ttlSeconds: 60 });
    expect(result).toEqual({ status: "error", message: "network", invalidIds: [], retry: true });
  });

  it("does nothing without settings or without devices", async () => {
    const fetchMock = mockFetch(200, { id: "x" });
    expect(await sendOneSignal([], PAYLOAD, { ttlSeconds: 60 })).toMatchObject({ status: "error", message: "no_devices", retry: false });
    vi.stubEnv("ONESIGNAL_API_KEY", "");
    expect(await sendOneSignal(IDS, PAYLOAD, { ttlSeconds: 60 })).toMatchObject({ status: "error", message: "not_configured", retry: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("cancelOneSignal", () => {
  it("takes back a scheduled message with the app id in the address", async () => {
    const fetchMock = mockFetch(200, { success: true });
    expect(await cancelOneSignal("msg-1")).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, { method: string }];
    expect(url).toBe("https://onesignal.com/api/v1/notifications/msg-1?app_id=app-1");
    expect(init.method).toBe("DELETE");
  });

  it("counts a message that is already gone as cancelled, and a failure as not", async () => {
    mockFetch(404, { errors: ["not found"] });
    expect(await cancelOneSignal("msg-1")).toBe(true);
    mockFetch(500, {});
    expect(await cancelOneSignal("msg-1")).toBe(false);
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    expect(await cancelOneSignal("msg-1")).toBe(false);
  });
});
