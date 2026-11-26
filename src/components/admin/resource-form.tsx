"use client";

import { CheckIcon, CloseIcon, CopyIcon, GalleryIcon, LoaderIcon } from "@solar-icons/react/line-duotone";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { RemoteImage } from "@/components/remote-image";
import { Chip } from "@/components/admin/auditorium-editor/chips";
import { ImageUpload, UploadBusyContext } from "@/components/image-upload";
import { RequiredMark } from "@/components/required-mark";

const ComboItemsField = dynamic(() => import("@/components/admin/combo-items-field").then((m) => m.ComboItemsField), { ssr: false });
const DeleteRecordButton = dynamic(() => import("@/components/admin/delete-record-button").then((m) => m.DeleteRecordButton), { ssr: false });
const TimeSlotsField = dynamic(() => import("@/components/admin/time-slots-field").then((m) => m.TimeSlotsField), { ssr: false });
import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/money-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  IDLE_STATE,
  VALIDATION_CODES,
  type RemoveResult,
  type SaveState,
  type ValidationCode,
} from "@/lib/admin/action-result";
import { cn } from "@/lib/utils";
import type { ResourceField } from "./resource-types";
import { PX } from "@/lib/ui-sizes";

function isValidationCode(code: string): code is ValidationCode {
  return VALIDATION_CODES.some((known) => known === code);
}

const CONTROL_CLASS = "h-control rounded-xl bg-card px-inset type-body";

/** Pick any number of options (chips); the choice travels as one comma-separated hidden field. */
function MultiSelectField({ name, label, options, initial, onEdit }: { name: string; label: string; options: { value: string; label: string }[]; initial: string; onEdit: () => void }) {
  const [chosen, setChosen] = useState<string[]>(() => initial.split(",").filter(Boolean));
  const toggle = (value: string) => {
    onEdit();
    setChosen((current) => (current.includes(value) ? current.filter((v) => v !== value) : [...current, value]));
  };
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-stack">
      <input type="hidden" name={name} value={chosen.join(",")} />
      {options.map((option) => (
        <Chip key={option.value} selected={chosen.includes(option.value)} onClick={() => toggle(option.value)}>
          {option.label}
        </Chip>
      ))}
    </div>
  );
}

/** Color swatch paired with a hex text input so admins can pick visually or paste an exact brand color. */
function ColorField({
  id,
  name,
  initial,
  placeholder,
  invalid,
  onEdit,
}: {
  id: string;
  name: string;
  initial: string;
  placeholder?: string;
  invalid: boolean;
  onEdit: () => void;
}) {
  const t = useTranslations("admin.common");
  const allowEmpty = Boolean(placeholder);
  const [hex, setHex] = useState(initial ? initial.toUpperCase() : allowEmpty ? "" : "#C61583");
  const validHex = /^#[0-9A-F]{6}$/i.test(hex) ? hex.toLowerCase() : allowEmpty ? "#8e1e36" : "#c61583";
  return (
    <div className="flex items-center gap-item">
      <input type="hidden" name={name} value={hex} />
      <input
        type="color"
        aria-label={name}
        value={validHex}
        onChange={(event) => {
          onEdit();
          setHex(event.target.value.toUpperCase());
        }}
        className={cn(
          "h-control w-swatch shrink-0 cursor-pointer rounded-xl border bg-card p-tight",
          allowEmpty && !hex && "opacity-60",
        )}
      />
      <div className="relative flex-1">
        <Input
          id={id}
          value={hex}
          onChange={(event) => {
            onEdit();
            setHex(event.target.value.toUpperCase());
          }}
          maxLength={7}
          placeholder={placeholder}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="off"
          aria-invalid={invalid || undefined}
          className={cn(CONTROL_CLASS, "tabular-nums", allowEmpty && hex && "pr-control")}
        />
        {allowEmpty && hex ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => {
              onEdit();
              setHex("");
            }}
            aria-label={t("clearColor")}
            className="absolute top-1/2 right-hair size-target -translate-y-1/2 text-muted-foreground"
          >
            <CloseIcon className="size-icon-sm" aria-hidden />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** Text field with a 44px copy button inside it (used for generated temporary passwords). */
function CopyableTextField({
  id,
  name,
  initial,
  invalid,
  required,
  maxLength,
  placeholder,
  last,
  onEdit,
}: {
  id: string;
  name: string;
  initial: string;
  invalid: boolean;
  required?: boolean;
  maxLength?: number;
  placeholder?: string;
  last: boolean;
  onEdit: () => void;
}) {
  const t = useTranslations("admin.common");
  const [text, setText] = useState(initial);
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  async function copy() {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
      toast.success(t("copied"));
    } catch {
      toast.error(t("errors.unknown"));
    }
  }

  return (
    <div className="relative">
      <Input
        id={id}
        name={name}
        type="text"
        value={text}
        onChange={(event) => {
          onEdit();
          setText(event.target.value);
        }}
        maxLength={maxLength}
        placeholder={placeholder}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        autoComplete="off"
        enterKeyHint={last ? "done" : "next"}
        aria-invalid={invalid || undefined}
        aria-required={required || undefined}
        className={`${CONTROL_CLASS} pr-control font-mono`}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={copy}
        aria-label={t("copy")}
        className="absolute top-1/2 right-hair size-target -translate-y-1/2 text-muted-foreground"
      >
        {copied ? <CheckIcon className="text-success" aria-hidden /> : <CopyIcon aria-hidden />}
      </Button>
    </div>
  );
}

interface FieldControlProps {
  field: ResourceField;
  value: string;
  invalid: boolean;
  /** The final typing field of the form, whose return key says "Done" instead of "Next". */
  last: boolean;
  /** Called when a select changes, so a field that depends on it (combo items on the brand) can follow. */
  onSelect: (name: string, value: string) => void;
  /** Clears an inline field error as soon as the person edits the field. */
  onEdit: () => void;
  /** Current value of every select of the form, by name. */
  selected: Record<string, string>;
  /** Starting values of the whole form (what was typed after a failed save, else the saved record). */
  siblings: Record<string, string>;
  /** Translated error of a field that has no control of its own in the list (the combo's discount). */
  discountError?: string;
}

function FieldControl({ field, value, invalid, last, onSelect, onEdit, selected, siblings, discountError }: FieldControlProps) {
  const isPlain = field.plain || field.kind === "url" || field.kind === "email";
  const common = { id: field.name, name: field.name, "aria-invalid": invalid || undefined, "aria-required": field.required || undefined } as const;

  switch (field.kind) {
    case "textarea":
      return (
        <Textarea
          {...common}
          defaultValue={value}
          onChange={onEdit}
          maxLength={field.maxLength}
          rows={3}
          placeholder={field.placeholder}
          className="resize-none overflow-y-auto rounded-xl bg-card px-inset py-inset-sm type-body"
        />
      );
    case "color":
      return (
        <ColorField
          id={field.name}
          name={field.name}
          initial={value}
          placeholder={field.placeholder}
          invalid={invalid}
          onEdit={onEdit}
        />
      );
    case "comboItems":
      return field.combo ? (
        <ComboItemsField
          config={field.combo}
          brandId={selected[field.combo.brandField] || undefined}
          initialItems={value}
          initialDiscountType={siblings.discountType ?? "amount"}
          initialDiscountValue={siblings.discountValue ?? ""}
          discountError={discountError}
          invalid={invalid}
        />
      ) : null;
    case "image":
      return (
        <ImageUpload
          name={field.name}
          initialUrl={value || undefined}
          getTicket={field.uploadTicket ?? (async () => ({ ok: false, error: "not_configured" }))}
          preview={(url) => (
            // A logo previews as a square; a movie poster keeps its 2:3 shape (same width, taller) so it is not cropped.
            <span aria-hidden className={`relative flex w-swatch shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-card ${field.imageShape === "poster" ? "aspect-[2/3]" : "aspect-square"}`}>
              {url ? <RemoteImage src={url} alt="" fill sizes={`${PX.swatch}px`} className="object-cover" /> : <GalleryIcon className="size-icon-lg text-muted-foreground" />}
            </span>
          )}
        />
      );
    case "timeSlots":
      return <TimeSlotsField name={field.name} initial={value} invalid={invalid} />;
    case "multiSelect":
      return <MultiSelectField name={field.name} label={field.label} options={field.options ?? []} initial={value} onEdit={onEdit} />;
    case "switch":
      return <Switch {...common} defaultChecked={value === "on"} onCheckedChange={onEdit} />;
    case "select":
      return (
        <Select
          name={field.name}
          defaultValue={value || undefined}
          onValueChange={(next) => {
            onEdit();
            onSelect(field.name, next);
          }}
        >
          <SelectTrigger id={field.name} aria-invalid={invalid || undefined} aria-required={field.required || undefined} className={`${CONTROL_CLASS} w-full`}>
            <SelectValue placeholder={field.placeholder} />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    default:
      if (field.kind === "number" && field.money) {
        return <MoneyInput {...common} enterKeyHint={last ? "done" : "next"} placeholder={field.placeholder} defaultValue={value} onValueChange={onEdit} className={CONTROL_CLASS} />;
      }
      if (field.kind === "text" && field.copyable) {
        return (
          <CopyableTextField
            id={field.name}
            name={field.name}
            initial={value}
            invalid={invalid}
            required={field.required}
            maxLength={field.maxLength}
            placeholder={field.placeholder}
            last={last}
            onEdit={onEdit}
          />
        );
      }
      return (
        <Input
          {...common}
          type={field.kind === "url" ? "url" : field.kind === "email" ? "email" : field.kind === "tel" ? "tel" : field.kind === "number" ? "number" : field.kind === "date" ? "date" : field.kind === "time" ? "time" : "text"}
          inputMode={field.kind === "email" ? "email" : field.kind === "tel" ? "tel" : field.kind === "number" ? (field.step === "1" ? "numeric" : "decimal") : undefined}
          step={field.step}
          min={field.min}
          max={field.max}
          maxLength={field.maxLength}
          placeholder={field.placeholder}
          autoCapitalize={isPlain ? "none" : undefined}
          autoCorrect={isPlain ? "off" : undefined}
          spellCheck={isPlain ? false : undefined}
          enterKeyHint={last ? "done" : "next"}
          // Off: otherwise iOS guesses a contact field and offers "AutoFill Contact" above the keyboard.
          autoComplete="off"
          defaultValue={value}
          onChange={onEdit}
          className={field.kind === "date" || field.kind === "time" ? `${CONTROL_CLASS} text-left [&::-webkit-date-and-time-value]:text-left` : CONTROL_CLASS}
        />
      );
  }
}

interface ResourceFormProps {
  /** The record being edited, or null when creating. */
  itemId: string | null;
  fields: ResourceField[];
  /** Starting values by field name (strings; a checked switch is "on"). Empty when creating. */
  values: Record<string, string>;
  /** The list this screen came from: where Save and Delete return to. */
  backHref: string;
  saveAction: (previous: SaveState, formData: FormData) => Promise<SaveState>;
  /** Edit screens: the record that Delete (beside Save) removes. Omit when creating. */
  deleteItem?: { id: string; name: string; removeAction: (id: string) => Promise<RemoveResult> };
  /** Extra content at the top of the form (for example the avatar picker); it is inside the form, so hidden inputs it holds are saved. */
  lead?: React.ReactNode;
  /** Admin pages sit beside a desktop sidebar (`md:left-sidebar`); user screens like `/profile/edit` center full-width. */
  hasSidebar?: boolean;
}

/**
 * The entry screen of a master-data record: a normal page (own URL, back button), not a sheet. Save is the one fixed
 * action at the bottom; once saved, the person goes back to the list they came from, which is refreshed to show the change.
 */
export function ResourceForm({ itemId, fields, values, backHref, saveAction, deleteItem, lead, hasSidebar = true }: ResourceFormProps) {
  const t = useTranslations("admin.common");
  const tv = useTranslations("admin.validation");
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(saveAction, IDLE_STATE);
  // The value of each select, followed live: a field can depend on another (the combo's items depend on its brand).
  const [selected, setSelected] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.filter((field) => field.kind === "select").map((field) => [field.name, values[field.name] ?? ""])),
  );
  // Track which field errors the person has started fixing since the last submit.
  const [cleared, setCleared] = useState<{ state: SaveState; names: Set<string> }>({ state: IDLE_STATE, names: new Set() });
  const clearedNames = cleared.state === state ? cleared.names : new Set<string>();
  const clearFieldError = (name: string) => {
    setCleared((prev) => {
      const base = prev.state === state ? prev.names : new Set<string>();
      if (base.has(name)) return prev;
      const next = new Set(base);
      next.add(name);
      return { state, names: next };
    });
  };

  useEffect(() => {
    if (state.status !== "success") return;
    // The toast lives in the root layout, so it survives the move back to the list.
    toast.success(t("saved"));
    // No router.refresh(): the save action already ran revalidatePath, which clears the client's cached pages, so the list opens fresh.
    router.replace(backHref);
  }, [state, t, router, backHref]);

  // A long form can hide the field that failed: scroll to the first one (no focus, so the keyboard does not pop up).
  useEffect(() => {
    if (state.status !== "error") return;
    const target = document.querySelector<HTMLElement>('form [aria-invalid="true"]');
    target?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [state]);

  const rawFieldErrors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const fieldErrors = Object.fromEntries(Object.entries(rawFieldErrors).filter(([name]) => !clearedNames.has(name)));
  // Pictures still going up: Save waits for them (see UploadBusyContext).
  const [uploads, setUploads] = useState(0);
  const reportUpload = useCallback((busy: boolean) => setUploads((n) => Math.max(0, n + (busy ? 1 : -1))), []);
  const uploading = uploads > 0;

  // After a failed save, start from what the user typed; otherwise from the saved record.
  const typed = state.status === "error" ? state.values : undefined;
  const formError = state.status === "error" && state.error !== "validation" ? state.error : null;
  const renderedNames = new Set(fields.map((f) => f.name));
  if (fields.some((f) => f.kind === "comboItems")) renderedNames.add("discountValue");
  const unrenderedErrors = Object.entries(fieldErrors)
    .filter(([name]) => !renderedNames.has(name))
    .map(([, code]) => tv(isValidationCode(code) ? code : "invalid"));
  const lastTypingField = fields.findLast((field) => !["switch", "color", "select", "textarea", "multiSelect", "image", "timeSlots"].includes(field.kind))?.name;

  // noValidate on the form: the server validates and returns translated messages, so the browser must not show its own.
  return (
    <UploadBusyContext.Provider value={reportUpload}>
    <form action={formAction} onSubmit={(event) => uploading && event.preventDefault()} noValidate className="flex flex-1 flex-col gap-field">
      {itemId ? <input type="hidden" name="id" value={itemId} /> : null}
      {lead}

      {fields.map((field) => {
        const code = fieldErrors[field.name];
        const horizontal = field.kind === "switch";
        return (
          <div key={field.name} className={horizontal ? "flex min-h-target items-center justify-between gap-group" : "flex min-w-0 flex-col gap-item"}>
            <div className="flex flex-col gap-tight">
              <Label htmlFor={field.name} className="text-muted-foreground">
                <span>
                  {field.label}
                  {field.required ? <RequiredMark /> : null}
                </span>
              </Label>
            </div>
            {/* key: remount with the typed value, since uncontrolled inputs ignore a changed defaultValue */}
            <FieldControl
              key={`${field.name}:${typed?.[field.name] ?? ""}`}
              field={field}
              value={typed ? (typed[field.name] ?? "") : (values[field.name] ?? "")}
              invalid={Boolean(code)}
              last={field.name === lastTypingField}
              onSelect={(name, next) => setSelected((current) => ({ ...current, [name]: next }))}
              onEdit={() => clearFieldError(field.name)}
              selected={selected}
              siblings={typed ?? values}
              discountError={field.kind === "comboItems" && fieldErrors.discountValue ? tv(isValidationCode(fieldErrors.discountValue) ? fieldErrors.discountValue : "invalid") : undefined}
            />
            {code ? (
              <p role="alert" className="-mt-tight type-secondary text-destructive">
                {tv(isValidationCode(code) ? code : "invalid")}
              </p>
            ) : null}
          </div>
        );
      })}

      {formError ? (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-inset py-inset-sm type-secondary text-destructive">
          {t(`errors.${formError}`)}
        </p>
      ) : null}

      {unrenderedErrors.length > 0 ? (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-inset py-inset-sm type-secondary text-destructive">
          {unrenderedErrors[0]}
        </p>
      ) : null}

      {/* Room for the fixed Save button, so the last field can scroll clear of it. */}
      <div aria-hidden className="h-save-clear shrink-0" />

      {/* Fixed to the bottom, in thumb reach. It stays while the keyboard is open: on the installed app the keyboard shrinks the page, so
          the bar rides just above it and Save is always reachable while typing (unlike the menu and the list's Add button, which hide). */}
      <div
        data-save-bar
        className={cn(
          "pointer-events-none fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-background via-background/95 to-transparent px-inset pt-group pb-(--inset-bottom)",
          hasSidebar && "md:left-sidebar",
        )}
      >
        <div className="mx-auto flex max-w-form items-center gap-stack">
          {deleteItem ? <DeleteRecordButton id={deleteItem.id} name={deleteItem.name} backHref={backHref} removeAction={deleteItem.removeAction} /> : null}
          <Button type="submit" size="cta" disabled={isPending || uploading} className="pointer-events-auto min-w-0 flex-1">
            {isPending ? (
              <>
                <LoaderIcon className="motion-safe:animate-spin" aria-hidden />
                {t("saving")}
              </>
            ) : uploading ? (
              <>
                <LoaderIcon className="motion-safe:animate-spin" aria-hidden />
                {t("uploading")}
              </>
            ) : (
              t("save")
            )}
          </Button>
        </div>
      </div>
    </form>
    </UploadBusyContext.Provider>
  );
}
