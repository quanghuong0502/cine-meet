"use client";

import { Check, Copy, LoaderCircle, Share2, UserMinus, UserPlus, Users, X } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";
import { removeFriendAction, respondRequestAction, sendFriendRequestAction } from "@/actions/friends";
import { PersonRow } from "@/components/friends/person-row";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mascot } from "@/components/mascot";
import { PX } from "@/lib/ui-sizes";
import type { FriendOverview, PersonView } from "@/services/friend.service";

const subscribeNothing = () => () => undefined;

interface Props {
  overview: FriendOverview;
  inviteCode: string | null;
}

/** The Friends screen: add by phone, share my link, answer requests, my friends. Writes show a toast; a failed network call says so. */
export function FriendsScreen({ overview, inviteCode }: Props) {
  const t = useTranslations("friends");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [sending, startSending] = useTransition();
  const [, startAnswer] = useTransition();
  const [removing, setRemoving] = useState<PersonView | null>(null);
  const [removePending, startRemove] = useTransition();

  function submitPhone(event: React.FormEvent) {
    event.preventDefault();
    setPhoneError(null);
    startSending(async () => {
      const result = await sendFriendRequestAction(phone).catch(() => null);
      if (!result) { toast.error(t("networkError")); return; }
      if (!result.ok) { setPhoneError(t(`errors.${result.error}`)); return; }
      setPhone("");
      // Same words whether or not the number has an account: nobody can use this to find out who is on the app.
      toast.success(t("requestSent"));
    });
  }

  function answer(person: PersonView & { friendshipId: string }, accept: boolean) {
    startAnswer(async () => {
      const result = await respondRequestAction(person.friendshipId, accept).catch(() => null);
      if (!result) { toast.error(t("networkError")); return; }
      if (!result.ok) { toast.error(t("errors.not_found")); return; }
      toast.success(accept ? t("accepted", { name: person.name }) : t("declined"));
    });
  }

  function confirmRemove() {
    if (!removing) return;
    const person = removing;
    startRemove(async () => {
      const result = await removeFriendAction(person.id).catch(() => null);
      setRemoving(null);
      if (!result) { toast.error(t("networkError")); return; }
      if (!result.ok) { toast.error(t("errors.not_found")); return; }
      toast.success(t("removed", { name: person.name }));
    });
  }

  // Taking back a request is easy to redo, so no confirmation.
  function cancelOutgoing(person: PersonView) {
    startAnswer(async () => {
      const result = await removeFriendAction(person.id).catch(() => null);
      if (!result) { toast.error(t("networkError")); return; }
      if (!result.ok) { toast.error(t("errors.not_found")); return; }
      toast.success(t("requestCancelled"));
    });
  }

  const inviteUrl = () => `${window.location.origin}/friends/invite/${inviteCode}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(inviteUrl());
      toast.success(t("linkCopied"));
    } catch {
      toast.error(t("linkCopyFailed"));
    }
  }

  async function shareLink() {
    try {
      await navigator.share({ title: t("shareTitle"), url: inviteUrl() });
    } catch {
      // The person closed the share sheet: nothing to report.
    }
  }

  // The share sheet exists only in the browser: the server draws no button, and the client adds it without a mismatch.
  const canShare = useSyncExternalStore(subscribeNothing, () => typeof navigator.share === "function", () => false);
  const empty = overview.friends.length === 0 && overview.incoming.length === 0 && overview.outgoing.length === 0;

  return (
    <div className="flex flex-col gap-section">
      <form onSubmit={submitPhone} noValidate className="flex flex-col gap-item">
        <Label htmlFor="friend-phone" className="type-label text-muted-foreground">
          {t("phoneLabel")}
        </Label>
        <div className="flex gap-stack">
          <Input
            id="friend-phone"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            enterKeyHint="send"
            maxLength={20}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder={t("phonePlaceholder")}
            aria-invalid={phoneError ? true : undefined}
            className="h-control min-w-0 flex-1 rounded-xl bg-card px-inset type-body"
          />
          <Button type="submit" size="pill" disabled={sending} className="shrink-0 px-inset">
            {sending ? <LoaderCircle className="motion-safe:animate-spin" aria-hidden /> : <UserPlus aria-hidden />}
            {t("addButton")}
          </Button>
        </div>
        {phoneError ? (
          <p role="alert" className="type-secondary text-destructive">
            {phoneError}
          </p>
        ) : null}
      </form>

      {inviteCode ? (
        <section aria-labelledby="friends-link" className="flex flex-col gap-item">
          <h2 id="friends-link" className="type-heading">
            {t("linkTitle")}
          </h2>
          <div className="flex gap-stack">
            <Button type="button" variant="outline" size="pill" onClick={copyLink} className="flex-1">
              <Copy aria-hidden />
              {t("copyLink")}
            </Button>
            {canShare ? (
              <Button type="button" variant="outline" size="pill" onClick={shareLink} className="flex-1">
                <Share2 aria-hidden />
                {t("shareLink")}
              </Button>
            ) : null}
          </div>
        </section>
      ) : null}

      {overview.incoming.length > 0 ? (
        <section aria-labelledby="friends-incoming" className="flex flex-col gap-item">
          <h2 id="friends-incoming" className="type-heading">
            {t("incomingTitle")}
          </h2>
          <ul className="flex flex-col gap-stack">
            {overview.incoming.map((person) => (
              <PersonRow key={person.friendshipId} name={person.name} avatar={person.avatar}>
                <Button type="button" variant="ghost" size="icon" aria-label={t("decline", { name: person.name })} onClick={() => answer(person, false)}>
                  <X aria-hidden />
                </Button>
                <Button type="button" size="icon" aria-label={t("accept", { name: person.name })} onClick={() => answer(person, true)}>
                  <Check aria-hidden />
                </Button>
              </PersonRow>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="friends-list" className="flex flex-col gap-item">
        <div className="flex items-center justify-between gap-item">
          <h2 id="friends-list" className="type-heading">
            {t("listTitle")}
          </h2>
          <Button asChild variant="ghost" className="h-target">
            <Link href="/friends/groups">
              <Users aria-hidden />
              {t("groupsLink")}
            </Link>
          </Button>
        </div>
        {overview.friends.length > 0 ? (
          <ul className="flex flex-col gap-stack">
            {overview.friends.map((person) => (
              <PersonRow key={person.id} name={person.name} avatar={person.avatar}>
                <Button type="button" variant="ghost" size="icon" aria-label={t("remove", { name: person.name })} onClick={() => setRemoving(person)}>
                  <UserMinus aria-hidden />
                </Button>
              </PersonRow>
            ))}
          </ul>
        ) : empty ? (
          <div className="flex flex-col items-center gap-item px-inset-lg py-inset-xl text-center">
            <Mascot pose="dudu-happy" size={PX.mascot} decorative />
            <p className="type-heading">{t("emptyTitle")}</p>
            <p className="max-w-hint type-secondary text-muted-foreground">{t("emptyDescription")}</p>
          </div>
        ) : (
          <p className="type-secondary text-muted-foreground">{t("noFriendsYet")}</p>
        )}
      </section>

      {overview.outgoing.length > 0 ? (
        <section aria-labelledby="friends-outgoing" className="flex flex-col gap-item">
          <h2 id="friends-outgoing" className="type-heading">
            {t("outgoingTitle")}
          </h2>
          <ul className="flex flex-col gap-stack">
            {overview.outgoing.map((person) => (
              <PersonRow key={person.id} name={person.name} avatar={person.avatar}>
                <Button type="button" variant="ghost" size="icon" aria-label={t("cancelRequest", { name: person.name })} onClick={() => cancelOutgoing(person)}>
                  <X aria-hidden />
                </Button>
              </PersonRow>
            ))}
          </ul>
        </section>
      ) : null}

      <AlertDialog open={removing !== null} onOpenChange={(open) => (open ? undefined : setRemoving(null))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="type-item-title">{t("removeTitle", { name: removing?.name ?? "" })}</AlertDialogTitle>
            <AlertDialogDescription>{t("removeDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removePending}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={removePending}
              className="border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20"
              onClick={(event) => {
                event.preventDefault();
                confirmRemove();
              }}
            >
              {removePending ? <LoaderCircle className="motion-safe:animate-spin" aria-hidden /> : <UserMinus aria-hidden />}
              {t("removeConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
