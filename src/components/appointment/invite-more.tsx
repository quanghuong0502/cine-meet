"use client";

import { LoaderIcon, UserPlusRoundedIcon } from "@solar-icons/react/line-duotone";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { inviteMoreAction } from "@/actions/appointments";
import { Chip } from "@/components/admin/auditorium-editor/chips";
import { Button } from "@/components/ui/button";

interface Props {
  appointmentId: string;
  /** Friends who are not in this appointment yet. */
  candidates: { id: string; name: string }[];
  groups: { id: string; name: string; memberIds: string[] }[];
}

/** Creator only: invite more friends while people can still answer. Only the new people are told. Draws nothing when nobody is left to invite. */
export function InviteMore({ appointmentId, candidates, groups }: Props) {
  const t = useTranslations("appointments.invite");
  const tc = useTranslations("appointments");
  const [picked, setPicked] = useState<string[]>([]);
  const [pending, start] = useTransition();

  // A group offers only the members who can still be invited.
  const offeredGroups = groups
    .map((g) => ({ ...g, memberIds: g.memberIds.filter((id) => candidates.some((c) => c.id === id)) }))
    .filter((g) => g.memberIds.length > 0);

  if (candidates.length === 0) return null;

  const toggle = (id: string) => setPicked((list) => (list.includes(id) ? list.filter((p) => p !== id) : [...list, id]));
  const groupChosen = (ids: string[]) => ids.every((id) => picked.includes(id));
  const toggleGroup = (ids: string[]) => setPicked((list) => (ids.every((id) => list.includes(id)) ? list.filter((id) => !ids.includes(id)) : [...new Set([...list, ...ids])]));

  function send() {
    if (picked.length === 0) return;
    start(async () => {
      const result = await inviteMoreAction(appointmentId, { inviteeIds: picked }).catch(() => null);
      if (!result) {
        toast.error(tc("networkError"));
        return;
      }
      if (!result.ok) {
        toast.error(result.error === "limit" ? t("limitReached") : tc(`errors.${result.error}`));
        return;
      }
      setPicked([]);
      toast.success(t("done", { count: result.count }));
    });
  }

  return (
    <section aria-labelledby="appt-invite-more" className="flex flex-col gap-item">
      <h2 id="appt-invite-more" className="type-heading">
        {t("title")}
      </h2>
      {offeredGroups.length > 0 ? (
        <div role="group" aria-label={t("groups")} className="flex flex-wrap gap-stack">
          {offeredGroups.map((group) => (
            <Chip key={group.id} selected={groupChosen(group.memberIds)} onClick={() => toggleGroup(group.memberIds)}>
              {group.name}
            </Chip>
          ))}
        </div>
      ) : null}
      <div role="group" aria-labelledby="appt-invite-more" className="flex flex-wrap gap-stack">
        {candidates.map((friend) => (
          <Chip key={friend.id} selected={picked.includes(friend.id)} onClick={() => toggle(friend.id)}>
            {friend.name}
          </Chip>
        ))}
      </div>
      <Button type="button" variant="outline" size="pill" disabled={pending || picked.length === 0} onClick={send} className="self-start">
        {pending ? <LoaderIcon className="motion-safe:animate-spin" aria-hidden /> : <UserPlusRoundedIcon aria-hidden />}
        {t("button", { count: picked.length })}
      </Button>
    </section>
  );
}
