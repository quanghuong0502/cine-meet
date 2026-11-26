"use client";

import { CheckIcon, RestartIcon } from "@solar-icons/react/line-duotone";
import { useTranslations } from "next-intl";
import { useState, useTransition, type CSSProperties } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEFAULT_BRAND_HEX, defaultBrandTheme, deriveBrandTheme, parseHex } from "@/lib/brand-theme";
import { cn } from "@/lib/utils";

const PRESETS = [
  { hex: "#C61583", key: "raspberry" },
  { hex: "#E11D48", key: "crimson" },
  { hex: "#EA580C", key: "tangerine" },
  { hex: "#0D9488", key: "teal" },
  { hex: "#2563EB", key: "cobalt" },
  { hex: "#7C3AED", key: "violet" },
] as const;

/**
 * The brand colour field of the Appearance screen: curated swatches, colour picker and hex box, with live Dark & Light previews
 * of the real tokens. It sits in `ResourceForm`'s `lead` slot, so the hidden `color` input below is what Save sends.
 */
export function BrandColorPicker({
  initialHex,
  label,
  resetAction,
}: {
  initialHex: string;
  label: string;
  /** Removes the saved colour for everyone (server action). */
  resetAction: () => Promise<{ ok: true }>;
}) {
  const t = useTranslations("admin.appearance");
  const tv = useTranslations("admin.validation");
  const tc = useTranslations("admin.common");
  const [hex, setHex] = useState(initialHex.toUpperCase());
  // What is saved right now: the reset button has nothing to do when both it and the box already show the default.
  const [savedHex, setSavedHex] = useState(initialHex.toUpperCase());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isResetting, startResetting] = useTransition();

  function reset() {
    startResetting(async () => {
      try {
        await resetAction();
        setHex(DEFAULT_BRAND_HEX);
        setSavedHex(DEFAULT_BRAND_HEX);
        setConfirmOpen(false);
        toast.success(t("resetDone"));
      } catch {
        setConfirmOpen(false);
        toast.error(tc("errors.unknown"));
      }
    });
  }

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

      <div className="flex flex-col gap-item">
        <label htmlFor="brand-hex" className="type-label text-muted-foreground">
          {label}
        </label>
        <div role="group" aria-label={t("presetsLabel")} className="flex flex-wrap gap-stack">
          {PRESETS.map((preset) => {
            const active = hex === preset.hex;
            return (
              <button
                key={preset.hex}
                type="button"
                aria-label={`${t(`presets.${preset.key}`)} (${preset.hex})`}
                aria-pressed={active}
                onClick={() => setHex(preset.hex)}
                style={{ backgroundColor: preset.hex }}
                className={cn(
                  "flex size-target items-center justify-center rounded-full border-2 text-white transition-transform outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95",
                  active ? "border-foreground" : "border-transparent",
                )}
              >
                {active ? <CheckIcon className="size-icon-sm" aria-hidden /> : null}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-item">
          <input
            type="color"
            aria-label={t("pickColor")}
            value={pickerValue}
            onChange={(event) => setHex(event.target.value.toUpperCase())}
            className="h-control w-swatch shrink-0 cursor-pointer rounded-xl border bg-card p-tight"
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
            className="h-control rounded-xl bg-card px-inset type-body tabular-nums"
          />
        </div>
        {!derived.ok ? (
          <p role="alert" className="-mt-tight type-secondary text-destructive">
            {tv(derived.error)}
          </p>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="cta-sm"
          className="w-auto self-start px-inset"
          disabled={hex === DEFAULT_BRAND_HEX && savedHex === DEFAULT_BRAND_HEX}
          onClick={() => setConfirmOpen(true)}
        >
          <RestartIcon aria-hidden />
          {t("reset")}
        </Button>
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={t("resetTitle")}
          description={t("resetDescription")}
          icon={<RestartIcon aria-hidden />}
          confirmLabel={t("resetConfirm")}
          pending={isResetting}
          onConfirm={reset}
        />
      </div>

      <div className="flex flex-col gap-item" aria-hidden>
        <span className="type-label text-muted-foreground">{t("preview.label")}</span>
        <div className="grid gap-item sm:grid-cols-2">
          {(["dark", "light"] as const).map((mode) => (
            <div key={mode} className="flex flex-col gap-stack">
              <span className="type-secondary text-muted-foreground">{t(`preview.${mode}`)}</span>
              <div className={cn(mode, "flex flex-col gap-group rounded-xl border bg-background p-inset text-foreground")} style={previewStyle}>
                <div className="flex items-center justify-between gap-item rounded-xl border bg-card p-inset-sm">
                  <span className="truncate type-item-title">{t("preview.heading")}</span>
                  <span className="shrink-0 rounded-full bg-accent px-inset-sm py-tight type-label text-accent-foreground">{t("preview.seats")}</span>
                </div>
                <span className="type-body font-medium! text-primary-text">{t("preview.link")}</span>
                <div className="flex h-control items-center justify-center rounded-full bg-primary px-inset type-item-title text-primary-foreground">{t("preview.button")}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
