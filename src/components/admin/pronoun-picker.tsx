"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Chip } from "@/components/admin/auditorium-editor/chips";
import { RequiredMark } from "@/components/required-mark";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { MAX_PRONOUN_LENGTH, parsePronoun, PRONOUN_PRESETS, pronounWord, type Pronouns } from "@/lib/pronouns";

interface WordFieldProps {
  id: "you" | "me";
  label: string;
  nameLabel: string;
  value: string;
  onChange: (next: string) => void;
  isName: boolean;
  onIsName: (next: boolean) => void;
  check: ReturnType<typeof parsePronoun>;
}

/** One word of address: its text, and whether it is a proper name (written with capitals everywhere). */
function WordField({ id, label, nameLabel, value, onChange, isName, onIsName, check }: WordFieldProps) {
  const tv = useTranslations("admin.validation");
  return (
    <div className="flex flex-col gap-item">
      <Label htmlFor={id} className="type-label text-muted-foreground">
        {label}
        <RequiredMark />
      </Label>
      <Input
        id={id}
        name={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={MAX_PRONOUN_LENGTH}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        autoComplete="off"
        aria-required
        aria-invalid={!check.ok || undefined}
        className="h-control rounded-xl bg-card px-inset type-body"
      />
      {!check.ok ? (
        <p role="alert" className="-mt-tight type-secondary text-destructive">
          {tv(check.error)}
        </p>
      ) : null}
      <div className="flex min-h-target items-center justify-between gap-item">
        <Label htmlFor={`${id}IsName`} className="type-body">
          {nameLabel}
        </Label>
        <Switch id={`${id}IsName`} name={`${id}IsName`} checked={isName} onCheckedChange={onIsName} />
      </div>
    </div>
  );
}

/**
 * The two words of address of the Pronouns screen: what the app calls the person and what it calls itself, typed freely or picked
 * from a few quick pairs, each with a "proper name" switch, and a live sample sentence. It sits in `ResourceForm`'s `lead` slot, so
 * the inputs and switches below are what Save sends.
 */
export function PronounPicker({ initial }: { initial: Pronouns }) {
  const t = useTranslations("admin.pronouns");
  const [you, setYou] = useState(initial.you);
  const [me, setMe] = useState(initial.me);
  const [youIsName, setYouIsName] = useState(initial.youIsName);
  const [meIsName, setMeIsName] = useState(initial.meIsName);
  const youCheck = parsePronoun(you);
  const meCheck = parsePronoun(me);
  const youWord = youCheck.ok ? youCheck.value : initial.you;
  const meWord = meCheck.ok ? meCheck.value : initial.me;
  const sample = t("sample", {
    you: pronounWord(youWord, youIsName, false),
    me: pronounWord(meWord, meIsName, false),
    You: pronounWord(youWord, youIsName, true),
    Me: pronounWord(meWord, meIsName, true),
  });

  return (
    <div className="flex flex-col gap-field">
      <div role="group" aria-label={t("presets")} className="flex flex-wrap gap-stack">
        {PRONOUN_PRESETS.map((pair) => (
          <Chip
            key={`${pair.you}-${pair.me}`}
            selected={youCheck.ok && meCheck.ok && youCheck.value === pair.you && meCheck.value === pair.me && !youIsName && !meIsName}
            onClick={() => {
              setYou(pair.you);
              setMe(pair.me);
              setYouIsName(false);
              setMeIsName(false);
            }}
          >
            {pair.you} – {pair.me}
          </Chip>
        ))}
      </div>
      <WordField id="you" label={t("fields.you.label")} nameLabel={t("isName")} value={you} onChange={setYou} isName={youIsName} onIsName={setYouIsName} check={youCheck} />
      <WordField id="me" label={t("fields.me.label")} nameLabel={t("isName")} value={me} onChange={setMe} isName={meIsName} onIsName={setMeIsName} check={meCheck} />
      <div className="flex flex-col gap-item">
        <p className="type-label text-muted-foreground">{t("preview")}</p>
        <p className="rounded-xl border bg-card p-inset type-body">{sample}</p>
      </div>
    </div>
  );
}
