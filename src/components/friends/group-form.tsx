"use client";

import { LoaderCircle, Save, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteGroupAction, saveGroupAction } from "@/actions/friends";
import { Chip } from "@/components/admin/auditorium-editor/chips";
import { RequiredMark } from "@/components/required-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_GROUP_NAME } from "@/lib/friend-constants";
import type { PersonView } from "@/services/friend.service";

interface Props {
  groupId?: string;
  initialName: string;
  initialMemberIds: string[];
  friends: PersonView[];
}

/** Create or edit a friend group: a name and which friends are in it. */
export function GroupForm({ groupId, initialName, initialMemberIds, friends }: Props) {
  const t = useTranslations("friends.groups");
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [members, setMembers] = useState<string[]>(initialMemberIds);
  const [nameError, setNameError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const toggle = (id: string) => setMembers((current) => (current.includes(id) ? current.filter((m) => m !== id) : [...current, id]));

  function save(event: React.FormEvent) {
    event.preventDefault();
    setNameError(null);
    if (!name.trim()) { setNameError(t("errors.required")); return; }
    start(async () => {
      const result = await saveGroupAction({ id: groupId, name, memberIds: members }).catch(() => null);
      if (!result) { toast.error(t("networkError")); return; }
      if (!result.ok) {
        if (result.error === "validation") { setNameError(t("errors.required")); return; }
        { toast.error(t(`errors.${result.error}`)); return; }
      }
      toast.success(t("saved"));
      router.replace("/friends/groups");
    });
  }

  function remove() {
    if (!groupId) return;
    start(async () => {
      const result = await deleteGroupAction(groupId).catch(() => null);
      if (!result) { toast.error(t("networkError")); return; }
      if (!result.ok) { toast.error(t("errors.not_found")); return; }
      toast.success(t("deleted"));
      router.replace("/friends/groups");
    });
  }

  return (
    <form onSubmit={save} noValidate className="flex flex-col gap-field">
      <div className="flex flex-col gap-item">
        <Label htmlFor="group-name" className="type-label text-muted-foreground">
          {t("nameLabel")}
          <RequiredMark />
        </Label>
        <Input
          id="group-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={MAX_GROUP_NAME}
          aria-required
          aria-invalid={nameError ? true : undefined}
          placeholder={t("namePlaceholder")}
          className="h-control rounded-xl bg-card px-inset type-body"
        />
        {nameError ? (
          <p role="alert" className="type-secondary text-destructive">
            {nameError}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-item">
        <span id="group-members" className="type-label text-muted-foreground">
          {t("membersLabel")}
        </span>
        {friends.length === 0 ? (
          <p className="type-secondary text-muted-foreground">{t("noFriends")}</p>
        ) : (
          <div role="group" aria-labelledby="group-members" className="flex flex-wrap gap-stack">
            {friends.map((friend) => (
              <Chip key={friend.id} selected={members.includes(friend.id)} onClick={() => toggle(friend.id)}>
                {friend.name}
              </Chip>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-stack">
        <Button type="submit" size="cta" disabled={pending}>
          {pending ? <LoaderCircle className="motion-safe:animate-spin" aria-hidden /> : <Save aria-hidden />}
          {t("save")}
        </Button>
        {groupId ? (
          <Button type="button" variant="destructive" size="cta-sm" disabled={pending} onClick={remove}>
            <Trash2 aria-hidden />
            {t("delete")}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
