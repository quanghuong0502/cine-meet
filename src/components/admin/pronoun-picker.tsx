"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Chip } from "@/components/admin/auditorium-editor/chips";
import { RequiredMark } from "@/components/required-mark";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_PRONOUN_LENGTH, parsePronoun, PRONOUN_PRESETS, type Pronouns } from "@/lib/pronouns";

/**
 * The two words of address of the Pronouns screen: what the app calls the person and what it calls itself, typed freely or picked
 * from a few quick pairs, with a live sample sentence. It sits in `ResourceForm`'s `lead` slot, so the two inputs below are what Save sends.
 */
export function PronounPicker({ initial }: { initial: Pronouns }) {
  const t = useTranslations("admin.pronouns");
  const tv = useTranslations("admin.validation");
  const [you, setYou] = useState(initial.you);
  const [me, setMe] = useState(initial.me);
  const youCheck = parsePronoun(you);
  const meCheck = parsePronoun(me);
  const youWord = youCheck.ok ? youCheck.value : initial.you;
  const meWord = meCheck.ok ? meCheck.value : initial.me;
  const upperFirst = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);
  const sample = t("sample", { you: youWord, me: meWord, You: upperFirst(youWord), Me: upperFirst(meWord) });

  const field = (id: string, label: string, value: string, onChange: (next: string) => void, check: ReturnType<typeof parsePronoun>) => (
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
    </div>
  );

  return (
    <div className="flex flex-col gap-field">
      <div role="group" aria-label={t("presets")} className="flex flex-wrap gap-stack">
        {PRONOUN_PRESETS.map((pair) => (
          <Chip
            key={`${pair.you}-${pair.me}`}
            selected={youCheck.ok && meCheck.ok && youCheck.value === pair.you && meCheck.value === pair.me}
            onClick={() => {
              setYou(pair.you);
              setMe(pair.me);
            }}
          >
            {pair.you} – {pair.me}
          </Chip>
        ))}
      </div>
      {field("you", t("fields.you.label"), you, setYou, youCheck)}
      {field("me", t("fields.me.label"), me, setMe, meCheck)}
      <div className="flex flex-col gap-item">
        <p className="type-label text-muted-foreground">{t("preview")}</p>
        <p className="rounded-xl border bg-card p-inset type-body">{sample}</p>
      </div>
    </div>
  );
}
