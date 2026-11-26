"use client";

import { CheckIcon, DisketteIcon, LoaderIcon, TrashBinMinimalisticIcon, UserPlusRoundedIcon } from "@solar-icons/react/line-duotone";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteGroupAction, saveGroupAction } from "@/actions/friends";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { RequiredMark } from "@/components/required-mark";
import { UserAvatar } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_GROUP_NAME } from "@/lib/friend-constants";
import { PX } from "@/lib/ui-sizes";
import { cn } from "@/lib/utils";
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
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saving, startSave] = useTransition();
  const [deleting, startDelete] = useTransition();

  const toggle = (id: string) => setMembers((current) => (current.includes(id) ? current.filter((m) => m !== id) : [...current, id]));

  function save(event: React.FormEvent) {
    event.preventDefault();
    setNameError(null);
    if (!name.trim()) { setNameError(t("errors.required")); return; }
    startSave(async () => {
      const result = await saveGroupAction({ id: groupId, name, memberIds: members }).catch(() => null);
      if (!result) { toast.error(t("networkError")); return; }
      if (!result.ok) {
        if (result.error === "validation") { setNameError(t("errors.required")); return; }
        toast.error(t(`errors.${result.error}`));
        return;
      }
      toast.success(t("saved"));
      router.replace("/friends/groups");
    });
  }

  function confirmDelete() {
    if (!groupId) return;
    startDelete(async () => {
      const result = await deleteGroupAction(groupId).catch(() => null);
      setDeleteOpen(false);
      if (!result) { toast.error(t("networkError")); return; }
      if (!result.ok) { toast.error(t("errors.not_found")); return; }
      toast.success(t("deleted"));
      router.replace("/friends/groups");
    });
  }

  return (
    <>
      <form onSubmit={save} noValidate className="flex flex-col gap-field">
        <div className="flex flex-col gap-item">
          <Label htmlFor="group-name" className="type-label text-muted-foreground">
            <span>
              {t("nameLabel")}
              <RequiredMark />
            </span>
          </Label>
          <Input
            id="group-name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (nameError) setNameError(null);
            }}
            enterKeyHint="done"
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
          <div className="flex items-center justify-between gap-item">
            <span id="group-members" className="type-label text-muted-foreground">
              {t("membersLabel")}
            </span>
            {friends.length > 0 ? (
              <Badge variant="secondary" className="tabular-nums">
                {t("selectedCount", { count: members.length })}
              </Badge>
            ) : null}
          </div>
          {friends.length === 0 ? (
            <div className="flex flex-col items-start gap-item rounded-xl border bg-card p-inset-sm">
              <p className="type-secondary text-muted-foreground">{t("noFriends")}</p>
              <Button asChild variant="outline" size="cta-sm" className="w-auto px-inset">
                <Link href="/friends">
                  <UserPlusRoundedIcon aria-hidden />
                  {t("addFriendsLink")}
                </Link>
              </Button>
            </div>
          ) : (
            <div role="group" aria-labelledby="group-members" className="grid gap-stack sm:grid-cols-2">
              {friends.map((friend) => {
                const selected = members.includes(friend.id);
                return (
                  <button
                    key={friend.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggle(friend.id)}
                    className={cn(
                      "flex min-h-row items-center gap-item rounded-xl border p-inset-sm text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:opacity-80",
                      selected ? "border-primary bg-accent/40" : "bg-card hover:bg-muted/50",
                    )}
                  >
                    <UserAvatar name={friend.name} image={friend.avatar} size={PX.avatar} />
                    <span className="min-w-0 flex-1 truncate type-item-title">{friend.name}</span>
                    <span
                      aria-hidden
                      className={cn(
                        "flex size-icon shrink-0 items-center justify-center rounded-full border",
                        selected ? "border-primary bg-primary text-primary-foreground" : "border-border",
                      )}
                    >
                      {selected ? <CheckIcon className="size-icon-xs" /> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-stack">
          <Button type="submit" size="cta" disabled={saving || deleting}>
            {saving ? <LoaderIcon className="motion-safe:animate-spin" aria-hidden /> : <DisketteIcon aria-hidden />}
            {t("save")}
          </Button>
          {groupId ? (
            <Button
              type="button"
              variant="outline"
              size="cta-sm"
              disabled={saving || deleting}
              onClick={() => setDeleteOpen(true)}
              className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <TrashBinMinimalisticIcon aria-hidden />
              {t("delete")}
            </Button>
          ) : null}
        </div>
      </form>

      {groupId ? (
        <ConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title={t("deleteTitle", { name: name.trim() || initialName })}
          description={t("deleteDescription")}
          tone="destructive"
          icon={<TrashBinMinimalisticIcon aria-hidden />}
          confirmLabel={t("delete")}
          pending={deleting}
          onConfirm={confirmDelete}
        />
      ) : null}
    </>
  );
}
