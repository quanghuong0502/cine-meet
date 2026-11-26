"use client";

import { LoaderIcon, UserPlusRoundedIcon } from "@solar-icons/react/line-duotone";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { sendInviteRequestAction } from "@/actions/friends";
import { Button } from "@/components/ui/button";

/** The button on the page a friend link opens: sends the request, then goes to the Friends screen. */
export function InviteAccept({ code, name, label }: { code: string; name: string; label?: string }) {
  const t = useTranslations("friends.invite");
  const router = useRouter();
  const [pending, start] = useTransition();

  function send() {
    start(async () => {
      const result = await sendInviteRequestAction(code).catch(() => null);
      if (!result) { toast.error(t("networkError")); return; }
      if (!result.ok) { toast.error(t(`errors.${result.error}`)); return; }
      toast.success(t(`done.${result.outcome}`, { name }));
      router.replace("/friends");
    });
  }

  return (
    <Button type="button" size="cta" onClick={send} disabled={pending}>
      {pending ? <LoaderIcon className="motion-safe:animate-spin" aria-hidden /> : <UserPlusRoundedIcon aria-hidden />}
      {label ?? t("button")}
    </Button>
  );
}
