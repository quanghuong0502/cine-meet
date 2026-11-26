"use client";

import { CheckIcon, CloseIcon, CopyIcon, LoaderIcon, RoundedMagnifierIcon, ShareIcon, UserMinusRoundedIcon, UserPlusRoundedIcon, UsersGroupRoundedIcon } from "@solar-icons/react/line-duotone";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";
import { removeFriendAction, respondRequestAction, sendFriendRequestAction } from "@/actions/friends";
import { EmptyState } from "@/components/empty-state";
import { PersonRow } from "@/components/friends/person-row";
import { LazyConfirmDialog } from "@/components/lazy-dialogs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FriendOverview, PersonView } from "@/services/friend.service";

const subscribeNothing = () => () => undefined;
const SEARCH_THRESHOLD = 8;

interface Props {
  overview: FriendOverview;
  inviteCode: string | null;
}

/** The Friends screen: add by phone, share my link, answer requests, my friends. Writes show a toast; a failed network call says so. */
export function FriendsScreen({ overview, inviteCode }: Props) {
  const t = useTranslations("friends");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sending, startSending] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startAnswer] = useTransition();
  const [removing, setRemoving] = useState<PersonView | null>(null);
  const [removePending, startRemove] = useTransition();

  useEffect(() => {
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

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
    setBusyId(person.friendshipId);
    startAnswer(async () => {
      const result = await respondRequestAction(person.friendshipId, accept).catch(() => null);
      setBusyId(null);
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
    setBusyId(person.id);
    startAnswer(async () => {
      const result = await removeFriendAction(person.id).catch(() => null);
      setBusyId(null);
      if (!result) { toast.error(t("networkError")); return; }
      if (!result.ok) { toast.error(t("errors.not_found")); return; }
      toast.success(t("requestCancelled"));
    });
  }

  const inviteUrl = () => `${window.location.origin}/friends/invite/${inviteCode}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(inviteUrl());
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
      toast.success(t("linkCopied"));
    } catch {
      toast.error(t("linkCopyFailed"));
    }
  }

  async function shareLink() {
    try {
      await navigator.share({ title: t("shareTitle"), url: inviteUrl() });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      await copyLink();
    }
  }

  // The share sheet exists only in the browser: the server draws no button, and the client adds it without a mismatch.
  const canShare = useSyncExternalStore(subscribeNothing, () => typeof navigator.share === "function", () => false);
  const empty = overview.friends.length === 0 && overview.incoming.length === 0 && overview.outgoing.length === 0;
  const showSearch = overview.friends.length >= SEARCH_THRESHOLD;
  const deferredSearch = useDeferredValue(search);
  const filteredFriends = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    if (!q) return overview.friends;
    return overview.friends.filter((f) => f.name.toLowerCase().includes(q));
  }, [overview.friends, deferredSearch]);

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
            onChange={(event) => {
              setPhone(event.target.value);
              if (phoneError) setPhoneError(null);
            }}
            placeholder={t("phonePlaceholder")}
            aria-invalid={phoneError ? true : undefined}
            className="h-control min-w-0 flex-1 rounded-xl bg-card px-inset type-body"
          />
          <Button type="submit" size="cta" disabled={sending} className="w-auto shrink-0 px-inset">
            {sending ? <LoaderIcon className="motion-safe:animate-spin" aria-hidden /> : <UserPlusRoundedIcon aria-hidden />}
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
          <div className="flex flex-wrap gap-stack">
            <Button type="button" variant="outline" size="cta-sm" onClick={copyLink} className="w-auto flex-auto px-inset-sm">
              {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
              {copied ? t("copiedShort") : t("copyLink")}
            </Button>
            {canShare ? (
              <Button type="button" variant="outline" size="cta-sm" onClick={shareLink} className="w-auto flex-auto px-inset-sm">
                <ShareIcon aria-hidden />
                {t("shareLink")}
              </Button>
            ) : null}
          </div>
        </section>
      ) : null}

      {overview.incoming.length > 0 ? (
        <section aria-labelledby="friends-incoming" className="flex flex-col gap-item">
          <div className="flex items-center gap-stack">
            <h2 id="friends-incoming" className="type-heading">
              {t("incomingTitle")}
            </h2>
            <Badge variant="secondary" className="tabular-nums">{overview.incoming.length}</Badge>
          </div>
          <ul className="flex flex-col gap-stack">
            {overview.incoming.map((person) => {
              const rowBusy = busyId === person.friendshipId;
              return (
                <PersonRow key={person.friendshipId} name={person.name} avatar={person.avatar}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={rowBusy}
                    aria-label={t("decline", { name: person.name })}
                    onClick={() => answer(person, false)}
                  >
                    <CloseIcon aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    disabled={rowBusy}
                    aria-label={t("accept", { name: person.name })}
                    onClick={() => answer(person, true)}
                  >
                    {rowBusy ? <LoaderIcon className="motion-safe:animate-spin" aria-hidden /> : <CheckIcon aria-hidden />}
                  </Button>
                </PersonRow>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="friends-list" className="flex flex-col gap-item">
        <div className="flex items-center justify-between gap-item">
          <div className="flex items-center gap-stack">
            <h2 id="friends-list" className="type-heading">
              {t("listTitle")}
            </h2>
            {overview.friends.length > 0 ? (
              <Badge variant="secondary" className="tabular-nums">{overview.friends.length}</Badge>
            ) : null}
          </div>
          <Button asChild variant="ghost" className="h-target">
            <Link href="/friends/groups">
              <UsersGroupRoundedIcon aria-hidden />
              {t("groupsLink")}
            </Link>
          </Button>
        </div>

        {showSearch ? (
          <div className="relative">
            <RoundedMagnifierIcon className="pointer-events-none absolute top-1/2 left-inset size-icon-sm -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchPlaceholder")}
              className="h-control rounded-xl bg-card pr-target pl-target type-body"
            />
            {search ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setSearch("")}
                aria-label={t("clearSearch")}
                className="absolute top-1/2 right-hair size-target -translate-y-1/2 text-muted-foreground"
              >
                <CloseIcon aria-hidden />
              </Button>
            ) : null}
          </div>
        ) : null}

        {overview.friends.length > 0 ? (
          filteredFriends.length > 0 ? (
            <ul className="flex flex-col gap-stack">
              {filteredFriends.map((person) => (
                <PersonRow key={person.id} name={person.name} avatar={person.avatar}>
                  <Button type="button" variant="ghost" size="icon" aria-label={t("remove", { name: person.name })} onClick={() => setRemoving(person)}>
                    <UserMinusRoundedIcon aria-hidden />
                  </Button>
                </PersonRow>
              ))}
            </ul>
          ) : (
            <p className="type-secondary text-muted-foreground">{t("noSearchMatch")}</p>
          )
        ) : empty ? (
          <EmptyState mascot="dudu-happy" title={t("emptyTitle")} description={t("emptyDescription")} />
        ) : (
          <p className="type-secondary text-muted-foreground">{t("noFriendsYet")}</p>
        )}
      </section>

      {overview.outgoing.length > 0 ? (
        <section aria-labelledby="friends-outgoing" className="flex flex-col gap-item">
          <div className="flex items-center gap-stack">
            <h2 id="friends-outgoing" className="type-heading">
              {t("outgoingTitle")}
            </h2>
            <Badge variant="secondary" className="tabular-nums">{overview.outgoing.length}</Badge>
          </div>
          <ul className="flex flex-col gap-stack">
            {overview.outgoing.map((person) => {
              const rowBusy = busyId === person.id;
              return (
                <PersonRow key={person.id} name={person.name} avatar={person.avatar}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={rowBusy}
                    aria-label={t("cancelRequest", { name: person.name })}
                    onClick={() => cancelOutgoing(person)}
                  >
                    {rowBusy ? <LoaderIcon className="motion-safe:animate-spin" aria-hidden /> : <CloseIcon aria-hidden />}
                  </Button>
                </PersonRow>
              );
            })}
          </ul>
        </section>
      ) : null}

      {removing !== null ? (
        <LazyConfirmDialog
          open
          onOpenChange={(open) => (open ? undefined : setRemoving(null))}
          title={t("removeTitle", { name: removing.name })}
          description={t("removeDescription")}
          tone="destructive"
          icon={<UserMinusRoundedIcon aria-hidden />}
          confirmLabel={t("removeConfirm")}
          pending={removePending}
          onConfirm={confirmRemove}
        />
      ) : null}
    </div>
  );
}
