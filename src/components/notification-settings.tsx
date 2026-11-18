"use client";

import { Bell, BellOff, LoaderCircle, Smartphone, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { removePushDeviceAction, savePushSubscriptionAction, setPushPreferenceAction } from "@/actions/push";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { formatDayLong } from "@/lib/datetime";
import type { NotificationType } from "@/notifications/types";
import type { DeviceView } from "@/services/push.service";

interface Props {
  /** VAPID public key; null when the server has no keys (push is off). */
  publicKey: string | null;
  devices: DeviceView[];
  /** Kinds the person turned off for push. */
  pushOff: NotificationType[];
  types: readonly NotificationType[];
}

type Support =
  | "checking"
  | "unsupported" // the browser has no Web Push
  | "needs_install" // iPhone and iPad only get push once the app is on the home screen
  | "ready";

/** The key goes to `subscribe` as bytes; it is stored and sent as URL-safe base64. */
function keyToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=").replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/**
 * Notification settings: turn push on for this device (asked only when the person taps, as the platform requires), send a test, see and
 * remove devices, and choose which kinds of message are pushed. In-app messages are always kept, so these switches only control push.
 */
export function NotificationSettings({ publicKey, devices: initialDevices, pushOff: initialOff, types }: Props) {
  const t = useTranslations("settings.notifications");
  const locale = useLocale();
  const [support, setSupport] = useState<Support>("checking");
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [devices, setDevices] = useState(initialDevices);
  const [off, setOff] = useState<NotificationType[]>(initialOff);
  const [pending, start] = useTransition();

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const hasPush = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      const apple = /iphone|ipad/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      const installed = window.matchMedia("(display-mode: standalone)").matches;
      if (!hasPush) return setSupport(apple && !installed ? "needs_install" : "unsupported");
      if (apple && !installed) return setSupport("needs_install");
      setPermission(Notification.permission);
      const registration = await navigator.serviceWorker.ready.catch(() => null);
      const current = await registration?.pushManager.getSubscription().catch(() => null);
      if (cancelled) return;
      setEndpoint(current?.endpoint ?? null);
      setSupport("ready");
    }
    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  const thisDevice = devices.find((d) => d.endpoint === endpoint);

  function turnOn() {
    start(async () => {
      try {
        // Asked here, after a tap, never when the app opens.
        const answer = await Notification.requestPermission();
        setPermission(answer);
        if (answer !== "granted") return;
        const registration = await navigator.serviceWorker.ready;
        const subscription =
          (await registration.pushManager.getSubscription()) ??
          (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(publicKey ?? "") }));
        const json = subscription.toJSON();
        const saved = await savePushSubscriptionAction({ endpoint: subscription.endpoint, keys: json.keys, userAgent: navigator.userAgent });
        if (!saved.ok) {
          toast.error(t("errors.saveFailed"));
          return;
        }
        setEndpoint(subscription.endpoint);
        setDevices((list) => [...list.filter((d) => d.endpoint !== subscription.endpoint), { id: subscription.endpoint, endpoint: subscription.endpoint, device: "other", createdAt: new Date().toISOString() }]);
        toast.success(t("turnedOn"));
      } catch {
        toast.error(t("errors.subscribeFailed"));
      }
    });
  }

  function removeDevice(device: DeviceView) {
    start(async () => {
      const result = await removePushDeviceAction(device.id).catch(() => null);
      if (!result) {
        toast.error(t("errors.network"));
        return;
      }
      // On this very device the browser's own subscription goes too, or it would keep accepting pushes that nobody sends.
      if (device.endpoint === endpoint) {
        const registration = await navigator.serviceWorker.ready.catch(() => null);
        await (await registration?.pushManager.getSubscription())?.unsubscribe().catch(() => undefined);
        setEndpoint(null);
      }
      setDevices((list) => list.filter((d) => d.id !== device.id));
      toast.success(t("removed"));
    });
  }

  function toggleType(type: NotificationType, enabled: boolean) {
    const before = off;
    setOff(enabled ? off.filter((o) => o !== type) : [...off, type]);
    start(async () => {
      const result = await setPushPreferenceAction(type, enabled).catch(() => null);
      if (!result?.ok) {
        setOff(before);
        toast.error(t("errors.network"));
      }
    });
  }

  const deviceName = (device: DeviceView) => (device.endpoint === endpoint ? t("thisDevice") : t(`devices.${device.device}`));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="type-item-title">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-section">
        {publicKey === null ? (
          <p role="status" className="type-secondary text-muted-foreground">
            {t("notConfigured")}
          </p>
        ) : support === "checking" ? null : support === "needs_install" ? (
          <p role="status" className="rounded-xl border bg-card p-inset-sm type-secondary">
            {t("needsInstall")}
          </p>
        ) : support === "unsupported" ? (
          <p role="status" className="type-secondary text-muted-foreground">
            {t("unsupported")}
          </p>
        ) : permission === "denied" ? (
          <p role="status" className="rounded-xl border border-destructive/40 bg-destructive/10 p-inset-sm type-secondary">
            <BellOff className="mr-stack inline size-icon-sm align-text-bottom" aria-hidden />
            {t("denied")}
          </p>
        ) : thisDevice ? (
          <p className="type-secondary text-muted-foreground">{t("on")}</p>
        ) : (
          <Button type="button" size="pill" disabled={pending} onClick={turnOn}>
            {pending ? <LoaderCircle className="motion-safe:animate-spin" aria-hidden /> : <Bell aria-hidden />}
            {t("turnOn")}
          </Button>
        )}

        {devices.length > 0 ? (
          <section aria-labelledby="push-devices" className="flex flex-col gap-item">
            <h3 id="push-devices" className="type-label text-muted-foreground">
              {t("devicesTitle")}
            </h3>
            <ul className="flex flex-col gap-stack">
              {devices.map((device) => (
                <li key={device.id} className="flex min-h-row items-center gap-item rounded-xl border bg-card p-inset-sm">
                  <Smartphone className="size-icon-lg shrink-0 text-muted-foreground" aria-hidden />
                  <span className="flex min-w-0 flex-1 flex-col gap-tight">
                    <span className="break-words type-item-title">{deviceName(device)}</span>
                    <span className="type-secondary text-muted-foreground tabular-nums">
                      {t("since", { date: `${formatDayLong(device.createdAt, locale)}` })}
                    </span>
                  </span>
                  <Button type="button" variant="ghost" size="icon" disabled={pending} aria-label={t("removeDevice", { name: deviceName(device) })} onClick={() => removeDevice(device)}>
                    <Trash2 aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section aria-labelledby="push-types" className="flex flex-col gap-stack">
          <h3 id="push-types" className="type-label text-muted-foreground">
            {t("typesTitle")}
          </h3>
          {types.map((type) => (
            <div key={type} className="flex min-h-target items-center justify-between gap-item">
              <Label htmlFor={`push-${type}`} className="type-body">
                {t(`types.${type}`)}
              </Label>
              <Switch id={`push-${type}`} checked={!off.includes(type)} onCheckedChange={(checked) => toggleType(type, checked)} />
            </div>
          ))}
        </section>
      </CardContent>
    </Card>
  );
}
