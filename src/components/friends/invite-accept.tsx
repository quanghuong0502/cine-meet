"use client";

import { LoaderCircle, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { sendInviteRequestAction } from "@/actions/friends";
import { Button } from "@/components/ui/button";

/** The button on the page a friend link opens: sends the request, then goes to the Friends screen. */
export function InviteAccept({ code, name }: { code: string; name: string }) {
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
      {pending ? <LoaderCircle className="motion-safe:animate-spin" aria-hidden /> : <UserPlus aria-hidden />}
      {t("button")}
    </Button>
  );
}
