"use client";

import { LoaderCircle, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition, type CSSProperties } from "react";
import { toast } from "sonner";
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
import { DEFAULT_BRAND_HEX, defaultBrandTheme, deriveBrandTheme, parseHex } from "@/lib/brand-theme";

/**
 * The brand colour field of the Appearance screen: a colour picker and a hex box, with a live preview of the real tokens.
 * It sits in `ResourceForm`'s `lead` slot, so the hidden `color` input below is what Save sends. The preview is a `.dark` box that
 * carries the brand variables itself: the stylesheet's dark block recomputes every colour there from them, so it shows the exact
 * result without touching the page around it.
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

      <div className="flex flex-col gap-3">
        <label htmlFor="brand-hex" className="type-label text-muted-foreground">
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
            className="h-control rounded-xl bg-card px-4 type-body tabular-nums"
          />
        </div>
        {!derived.ok ? (
          <p role="alert" className="-mt-1 type-secondary text-destructive">
            {tv(derived.error)}
          </p>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="cta-sm"
          className="w-auto self-start px-4"
          disabled={hex === DEFAULT_BRAND_HEX && savedHex === DEFAULT_BRAND_HEX}
          onClick={() => setConfirmOpen(true)}
        >
          <RotateCcw aria-hidden />
          {t("reset")}
        </Button>
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="type-item-title">{t("resetTitle")}</AlertDialogTitle>
              <AlertDialogDescription>{t("resetDescription")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isResetting}>{tc("cancel")}</AlertDialogCancel>
              <AlertDialogAction
                disabled={isResetting}
                onClick={(event) => {
                  event.preventDefault();
                  reset();
                }}
              >
                {isResetting ? <LoaderCircle className="motion-safe:animate-spin" aria-hidden /> : <RotateCcw aria-hidden />}
                {t("resetConfirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="flex flex-col gap-3" aria-hidden>
        <span className="type-label text-muted-foreground">{t("preview.label")}</span>
        <div className="dark flex flex-col gap-4 rounded-xl border bg-background p-4 text-foreground" style={previewStyle}>
          <div className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4">
            <span className="type-item-title">{t("preview.heading")}</span>
            <span className="rounded-full bg-accent px-3 py-1 type-label text-accent-foreground">{t("preview.seats")}</span>
          </div>
          <span className="type-body font-medium! text-primary-text">{t("preview.link")}</span>
          <div className="flex h-control items-center justify-center rounded-full bg-primary px-8 type-item-title text-primary-foreground">{t("preview.button")}</div>
        </div>
      </div>
    </div>
  );
}
