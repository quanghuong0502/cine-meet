"use client";

import { AltArrowDownIcon, AltArrowUpIcon, BellIcon, BellOffIcon, LoaderIcon, RefreshIcon, SmartphoneIcon, TrashBinMinimalisticIcon } from "@solar-icons/react/line-duotone";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { removePushDeviceAction, saveOneSignalDeviceAction, savePushSubscriptionAction, setPushPreferenceAction } from "@/actions/push";
import { LazyConfirmDialog } from "@/components/lazy-dialogs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconBadge } from "@/components/ui/icon-badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { formatDayLong } from "@/lib/datetime";
import { loadOneSignal, waitForSubscriptionId } from "@/lib/onesignal-client";
import type { PushProvider } from "@/notifications/provider";
import { NOTIFICATION_GROUPS, type NotificationType } from "@/notifications/types";
import type { DeviceView } from "@/services/push.service";

interface Props {
  /** Who delivers pushes on this server (PUSH_PROVIDER). */
  provider: PushProvider;
  /** VAPID public key (Web Push); null when the server has no keys, so push is off. */
  publicKey: string | null;
  /** OneSignal app id (OneSignal); null when it is not set up, so push is off. The REST key never comes here. */
  oneSignalAppId: string | null;
  devices: DeviceView[];
  /** Kinds the person turned off for push. */
  pushOff: NotificationType[];
  types: readonly NotificationType[];
}

type Support =
  | "checking"
  | "insecure" // opened over plain http (a LAN address): browsers switch service workers and push off
  | "unsupported" // the browser has no Web Push
  | "needs_install" // iPhone and iPad only get push once the app is on the home screen
  | "load_failed" // OneSignal's script could not be loaded (offline, or blocked)
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
 * Notification settings: turn push on for this device (asked only when the person taps, as the platform requires), see and
 * remove devices, and choose which kinds of message are pushed. In-app messages are always kept, so these switches only control push.
 */
export function NotificationSettings({ provider, publicKey, oneSignalAppId, devices: initialDevices, pushOff: initialOff, types }: Props) {
  const t = useTranslations("settings.notifications");
  const locale = useLocale();
  const configured = provider === "onesignal" ? oneSignalAppId !== null : publicKey !== null;
  const [support, setSupport] = useState<Support>("checking");
  const [retryTick, setRetryTick] = useState(0);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  // What tells this device apart from the others in the list: its Web Push endpoint, or (OneSignal) its OneSignal subscription id.
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [devices, setDevices] = useState(initialDevices);
  const [off, setOff] = useState<NotificationType[]>(initialOff);
  const [typesExpanded, setTypesExpanded] = useState(initialDevices.length > 0);
  const [confirmDevice, setConfirmDevice] = useState<DeviceView | null>(null);
  const [devicePending, startDevice] = useTransition();
  const [, startType] = useTransition();

  const hasSavedDevices = initialDevices.length > 0;
  useEffect(() => {
    let cancelled = false;
    async function check() {
      // Service workers and push exist only on https or localhost; on http://192.168... the browser hides them entirely.
      if (!window.isSecureContext) return setSupport("insecure");
      const hasPush = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      const apple = /iphone|ipad/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      const installed = window.matchMedia("(display-mode: standalone)").matches;
      if (!hasPush) return setSupport(apple && !installed ? "needs_install" : "unsupported");
      if (apple && !installed) return setSupport("needs_install");
      setPermission(Notification.permission);
      if (provider === "onesignal") {
        // Only worth loading OneSignal's script when the server is set up for it.
        if (!oneSignalAppId) return;
        // Defer downloading the 100+ KB OneSignal SDK on /settings until the user has granted permission, already has a device, or toggles push ON.
        if (Notification.permission !== "granted" && !hasSavedDevices && retryTick === 0) {
          setEndpoint(null);
          return setSupport("ready");
        }
        const oneSignal = await loadOneSignal(oneSignalAppId).catch(() => null);
        if (cancelled) return;
        if (!oneSignal) return setSupport("load_failed");
        const subscription = oneSignal.User.PushSubscription;
        setEndpoint(subscription.optedIn ? (subscription.id ?? null) : null);
        return setSupport("ready");
      }
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
  }, [provider, oneSignalAppId, retryTick, hasSavedDevices]);

  const thisDevice = devices.find((d) => d.endpoint === endpoint);

  /** This device is now saved on the server: show it as on, in the list too. */
  function markOn(device: DeviceView) {
    setEndpoint(device.endpoint);
    setDevices((list) => [...list.filter((d) => d.endpoint !== device.endpoint && d.id !== device.id), device]);
    setTypesExpanded(true);
    toast.success(t("turnedOn"));
  }

  function turnOn() {
    startDevice(async () => {
      try {
        if (provider === "onesignal") {
          // Asked here, after a tap, never when the app opens.
          const oneSignal = await loadOneSignal(oneSignalAppId ?? "");
          await oneSignal.Notifications.requestPermission();
          setPermission(Notification.permission);
          if (Notification.permission !== "granted") return;
          await oneSignal.User.PushSubscription.optIn();
          const subscriptionId = await waitForSubscriptionId(oneSignal);
          if (!subscriptionId) {
            toast.error(t("errors.subscribeFailed"));
            return;
          }
          const saved = await saveOneSignalDeviceAction({ subscriptionId, userAgent: navigator.userAgent });
          if (!saved.ok) {
            toast.error(t("errors.saveFailed"));
            return;
          }
          markOn(saved.device);
          return;
        }
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
        markOn(saved.device);
      } catch {
        toast.error(t("errors.subscribeFailed"));
      }
    });
  }

  function removeDevice(device: DeviceView, message: "removed" | "turnedOff" = "removed") {
    startDevice(async () => {
      const result = await removePushDeviceAction(device.id).catch(() => null);
      setConfirmDevice(null);
      if (!result?.ok) {
        toast.error(t("errors.network"));
        return;
      }
      // On this very device the browser's own subscription goes too, or it would keep accepting pushes that nobody sends.
      if (device.endpoint === endpoint) {
        if (provider === "onesignal") {
          const oneSignal = await loadOneSignal(oneSignalAppId ?? "").catch(() => null);
          await oneSignal?.User.PushSubscription.optOut().catch(() => undefined);
        } else {
          const registration = await navigator.serviceWorker.ready.catch(() => null);
          await (await registration?.pushManager.getSubscription())?.unsubscribe().catch(() => undefined);
        }
        setEndpoint(null);
      }
      setDevices((list) => list.filter((d) => d.id !== device.id));
      toast.success(t(message));
    });
  }

  function toggleType(type: NotificationType, enabled: boolean) {
    const before = off;
    setOff(enabled ? off.filter((o) => o !== type) : [...off, type]);
    startType(async () => {
      const result = await setPushPreferenceAction(type, enabled).catch(() => null);
      if (!result?.ok) {
        setOff(before);
        toast.error(t("errors.network"));
      }
    });
  }

  const deviceName = (device: DeviceView) => (device.endpoint === endpoint ? t("thisDevice") : t(`devices.${device.device}`));
  const hasDevices = devices.length > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-item">
          <IconBadge tone="primary">
            <BellIcon />
          </IconBadge>
          <CardTitle className="type-item-title">{t("title")}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-section">
        {!configured ? (
          <p role="status" className="type-secondary text-muted-foreground">
            {t("notConfigured")}
          </p>
        ) : support === "checking" ? null : support === "load_failed" ? (
          <div role="status" className="flex flex-col items-start gap-item rounded-xl border bg-background p-inset-sm">
            <p className="type-secondary text-muted-foreground">{t("loadFailed")}</p>
            <Button
              type="button"
              variant="outline"
              size="cta-sm"
              className="w-auto px-inset"
              onClick={() => {
                setSupport("checking");
                setRetryTick((n) => n + 1);
              }}
            >
              <RefreshIcon aria-hidden />
              {t("retry")}
            </Button>
          </div>
        ) : support === "needs_install" ? (
          <div role="status" className="flex flex-col gap-stack rounded-xl border bg-background p-inset-sm type-secondary">
            <p className="font-medium text-foreground">{t("needsInstallTitle")}</p>
            <ol className="flex list-decimal flex-col gap-tight pl-inset text-muted-foreground">
              <li>{t("needsInstallStep1")}</li>
              <li>{t("needsInstallStep2")}</li>
              <li>{t("needsInstallStep3")}</li>
            </ol>
          </div>
        ) : support === "insecure" ? (
          <p role="status" className="rounded-xl border bg-background p-inset-sm type-secondary">
            {t("insecure")}
          </p>
        ) : support === "unsupported" ? (
          <p role="status" className="type-secondary text-muted-foreground">
            {t("unsupported")}
          </p>
        ) : permission === "denied" ? (
          <p role="status" className="rounded-xl border border-destructive/40 bg-destructive/10 p-inset-sm type-secondary">
            <BellOffIcon className="mr-stack inline size-icon-sm align-text-bottom" aria-hidden />
            {t("denied")}
          </p>
        ) : (
          // The person decides, here and only here: on asks the browser for permission (when it has not been given yet), off stops pushes on this device.
          <div className="flex min-h-target items-center justify-between gap-item">
            <Label htmlFor="push-this-device" className="type-body">
              {t("deviceSwitch")}
            </Label>
            <div className="flex items-center gap-stack">
              {devicePending ? <LoaderIcon className="size-icon shrink-0 text-muted-foreground motion-safe:animate-spin" aria-hidden /> : null}
              <Switch
                id="push-this-device"
                checked={Boolean(thisDevice)}
                disabled={devicePending}
                onCheckedChange={(checked) => (checked ? turnOn() : thisDevice ? removeDevice(thisDevice, "turnedOff") : undefined)}
              />
            </div>
          </div>
        )}

        {hasDevices ? (
          <section aria-labelledby="push-devices" className="flex flex-col gap-item">
            <h3 id="push-devices" className="type-label text-muted-foreground">
              {t("devicesTitle")}
            </h3>
            <ul className="flex flex-col gap-stack">
              {devices.map((device) => (
                <li key={device.id} className="flex min-h-row items-center gap-item rounded-xl border bg-background p-inset-sm">
                  <IconBadge tone={device.endpoint === endpoint ? "primary" : "muted"} size="md">
                    <SmartphoneIcon />
                  </IconBadge>
                  <span className="flex min-w-0 flex-1 flex-col gap-tight">
                    <span className="break-words type-item-title">{deviceName(device)}</span>
                    <span className="type-secondary text-muted-foreground tabular-nums">
                      {t("since", { date: `${formatDayLong(device.createdAt, locale)}` })}
                    </span>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={devicePending}
                    aria-label={t("removeDevice", { name: deviceName(device) })}
                    onClick={() => (device.endpoint === endpoint ? removeDevice(device, "turnedOff") : setConfirmDevice(device))}
                  >
                    <TrashBinMinimalisticIcon aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section aria-labelledby="push-types" className="flex flex-col gap-item">
          <button
            type="button"
            aria-expanded={typesExpanded}
            onClick={() => setTypesExpanded((v) => !v)}
            className="flex min-h-target items-center justify-between gap-item rounded-xl text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span className="flex flex-col gap-tight">
              <h3 id="push-types" className="type-label text-muted-foreground">
                {t("typesTitle")}
              </h3>
              {!hasDevices ? <span className="type-secondary text-muted-foreground">{t("typesInactiveNote")}</span> : null}
            </span>
            {typesExpanded ? <AltArrowUpIcon className="size-icon-sm shrink-0 text-muted-foreground" aria-hidden /> : <AltArrowDownIcon className="size-icon-sm shrink-0 text-muted-foreground" aria-hidden />}
          </button>

          {typesExpanded ? (
            <div className={cn("flex flex-col gap-group", !hasDevices && "opacity-75")}>
              {NOTIFICATION_GROUPS.map((group, index) => {
                const shown = group.types.filter((type): type is NotificationType => types.includes(type));
                if (shown.length === 0) return null;
                return (
                  <div key={group.id} role="group" aria-labelledby={`push-group-${group.id}`} className={cn("flex flex-col gap-stack", index > 0 && "border-t pt-group")}>
                    <h4 id={`push-group-${group.id}`} className="type-label text-muted-foreground">
                      {t(`groups.${group.id}`)}
                    </h4>
                    {shown.map((type) => (
                      <div key={type} className="flex min-h-target items-center justify-between gap-item">
                        <Label htmlFor={`push-${type}`} className="type-body">
                          {t(`types.${type}`)}
                        </Label>
                        <Switch id={`push-${type}`} checked={!off.includes(type)} onCheckedChange={(checked) => toggleType(type, checked)} />
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ) : null}
        </section>
      </CardContent>

      {confirmDevice !== null ? (
        <LazyConfirmDialog
          open
          onOpenChange={(open) => (open ? undefined : setConfirmDevice(null))}
          title={t("removeDeviceTitle", { name: deviceName(confirmDevice) })}
          description={t("removeDeviceDescription")}
          tone="destructive"
          icon={<TrashBinMinimalisticIcon aria-hidden />}
          confirmLabel={t("removeDeviceConfirm")}
          pending={devicePending}
          onConfirm={() => {
            removeDevice(confirmDevice, "removed");
          }}
        />
      ) : null}
    </Card>
  );
}
