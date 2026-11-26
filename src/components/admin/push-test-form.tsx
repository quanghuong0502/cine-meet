"use client";

import { LoaderIcon, PlaneIcon } from "@solar-icons/react/line-duotone";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { sendTestPushAction } from "@/actions/push";
import { RequiredMark } from "@/components/required-mark";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PushTarget } from "@/services/push.service";

/** Pick a person and send a test push to all their devices: the admin's way to check push works for someone. */
export function PushTestForm({ targets, configured }: { targets: PushTarget[]; configured: boolean }) {
  const t = useTranslations("admin.pushTest");
  const [userId, setUserId] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function send(event: React.FormEvent) {
    event.preventDefault();
    if (!userId) {
      setError(t("errors.pick"));
      return;
    }
    setError("");
    start(async () => {
      const result = await sendTestPushAction(userId).catch(() => null);
      if (!result) {
        toast.error(t("errors.network"));
        return;
      }
      if (!result.ok) {
        toast.error(t(`errors.${result.error}`));
        return;
      }
      const { sent, failed, removed, errors } = result.result;
      if (sent + failed + removed === 0) toast.error(t("noDevice", { name: result.name }));
      else if (sent > 0) toast.success(t("sent", { name: result.name, count: sent }));
      else toast.error(t("allFailed", { name: result.name, reason: errors.join(", ") || "?" }));
    });
  }

  return (
    <form onSubmit={send} noValidate className="flex flex-col gap-field">
      {!configured ? (
        <p role="status" className="rounded-xl border border-destructive/40 bg-destructive/10 p-inset-sm type-secondary">
          {t("notConfigured")}
        </p>
      ) : null}
      <div className="flex flex-col gap-item">
        <Label htmlFor="push-target" className="type-label text-muted-foreground">
          {t("targetLabel")}
          <RequiredMark />
        </Label>
        <Select value={userId} onValueChange={setUserId}>
          <SelectTrigger id="push-target" aria-required aria-invalid={error ? true : undefined} className="h-control w-full rounded-xl bg-card px-inset type-body">
            <SelectValue placeholder={t("targetPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {targets.map((target) => (
              <SelectItem key={target.id} value={target.id}>
                {t("targetOption", { name: target.name, count: target.deviceCount })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {error ? (
          <p role="alert" className="type-secondary text-destructive">
            {error}
          </p>
        ) : null}
      </div>
      <Button type="submit" size="cta" disabled={pending || !configured}>
        {pending ? <LoaderIcon className="motion-safe:animate-spin" aria-hidden /> : <PlaneIcon aria-hidden />}
        {t("send")}
      </Button>
    </form>
  );
}
