"use client";

import { useTranslations } from "next-intl";
import { useState, type CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEFAULT_BRAND_HEX, defaultBrandTheme, deriveBrandTheme, parseHex } from "@/lib/brand-theme";

/**
 * The brand colour field of the Appearance screen: a colour picker and a hex box, with a live preview of the real tokens.
 * It sits in `ResourceForm`'s `lead` slot, so the hidden `color` input below is what Save sends. The preview is a `.dark` box that
 * carries the brand variables itself: the stylesheet's dark block recomputes every colour there from them, so it shows the exact
 * result without touching the page around it.
 */
export function BrandColorPicker({ initialHex, label }: { initialHex: string; label: string }) {
  const t = useTranslations("admin.appearance");
  const tv = useTranslations("admin.validation");
  const [hex, setHex] = useState(initialHex.toUpperCase());

  const derived = deriveBrandTheme(hex);
  const theme = derived.ok ? derived.theme : defaultBrandTheme();
  const previewStyle = {
    "--brand-h": theme.h,
    "--brand-c": theme.c,
    "--brand-l": theme.l,
    "--brand-fg": theme.fg,
    "--brand-ink": theme.ink,
  } as CSSProperties;
  const pickerValue = parseHex(hex) ? hex.toLowerCase() : DEFAULT_BRAND_HEX.toLowerCase();

  return (
    <div className="flex flex-col gap-field">
      <input type="hidden" name="color" value={hex} />

      <div className="flex flex-col gap-3">
        <label htmlFor="brand-hex" className="text-sm font-medium text-muted-foreground">
          {label}
        </label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            aria-label={t("pickColor")}
            value={pickerValue}
            onChange={(event) => setHex(event.target.value.toUpperCase())}
            className="h-control w-20 shrink-0 cursor-pointer rounded-xl border bg-card p-1"
          />
          <Input
            id="brand-hex"
            value={hex}
            onChange={(event) => setHex(event.target.value.toUpperCase())}
            maxLength={7}
            inputMode="text"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="off"
            aria-invalid={!derived.ok || undefined}
            className="h-control rounded-xl bg-card px-4 text-base tabular-nums"
          />
        </div>
        {!derived.ok ? (
          <p role="alert" className="-mt-1 text-sm text-destructive">
            {tv(derived.error)}
          </p>
        ) : null}
        {hex !== DEFAULT_BRAND_HEX ? (
          <Button type="button" variant="ghost" size="cta-sm" className="w-auto self-start px-4 text-muted-foreground" onClick={() => setHex(DEFAULT_BRAND_HEX)}>
            {t("useDefault")}
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-3" aria-hidden>
        <span className="text-sm font-medium text-muted-foreground">{t("preview.label")}</span>
        <div className="dark flex flex-col gap-4 rounded-xl border bg-background p-4 text-foreground" style={previewStyle}>
          <div className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4">
            <span className="text-base font-semibold">{t("preview.heading")}</span>
            <span className="rounded-full bg-accent px-3 py-1 text-sm font-medium text-accent-foreground">{t("preview.seats")}</span>
          </div>
          <span className="text-base font-medium text-primary-text">{t("preview.link")}</span>
          <div className="flex h-control items-center justify-center rounded-full bg-primary px-8 text-base font-semibold text-primary-foreground">{t("preview.button")}</div>
        </div>
      </div>
    </div>
  );
}
