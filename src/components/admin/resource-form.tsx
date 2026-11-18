"use client";

import { ImageIcon, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ComboItemsField } from "@/components/admin/combo-items-field";
import { DeleteRecordButton } from "@/components/admin/delete-record-button";
import { Chip } from "@/components/admin/auditorium-editor/chips";
import { ImageUpload } from "@/components/image-upload";
import { TimeSlotsField } from "@/components/admin/time-slots-field";
import { RequiredMark } from "@/components/required-mark";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import type { ResourceField } from "./resource-types";

function isValidationCode(code: string): code is ValidationCode {
  return VALIDATION_CODES.some((known) => known === code);
}

const CONTROL_CLASS = "h-control rounded-xl bg-card px-inset type-body";

/** Pick any number of options (chips); the choice travels as one comma-separated hidden field. */
function MultiSelectField({ name, label, options, initial }: { name: string; label: string; options: { value: string; label: string }[]; initial: string }) {
  const [chosen, setChosen] = useState<string[]>(() => initial.split(",").filter(Boolean));
  const toggle = (value: string) => setChosen((current) => (current.includes(value) ? current.filter((v) => v !== value) : [...current, value]));
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

interface FieldControlProps {
  field: ResourceField;
  value: string;
  invalid: boolean;
  /** The final typing field of the form, whose return key says "Done" instead of "Next". */
  last: boolean;
  /** Called when a select changes, so a field that depends on it (combo items on the brand) can follow. */
  onSelect: (name: string, value: string) => void;
  /** Current value of every select of the form, by name. */
  selected: Record<string, string>;
  /** Starting values of the whole form (what was typed after a failed save, else the saved record). */
  siblings: Record<string, string>;
  /** Translated error of a field that has no control of its own in the list (the combo's discount). */
  discountError?: string;
}

function FieldControl({ field, value, invalid, last, onSelect, selected, siblings, discountError }: FieldControlProps) {
  const isPlain = field.plain || field.kind === "url" || field.kind === "email";
  const common = { id: field.name, name: field.name, "aria-invalid": invalid || undefined, "aria-required": field.required || undefined } as const;

  switch (field.kind) {
    case "textarea":
      return <Textarea {...common} defaultValue={value} maxLength={field.maxLength} rows={3} placeholder={field.placeholder} className="resize-none overflow-y-auto rounded-xl bg-card px-inset py-inset-sm type-body" />;
    case "color":
      return (
        <input
          {...common}
          type="color"
          defaultValue={value || "#c61583"}
          className="h-control w-swatch cursor-pointer rounded-xl border bg-card p-tight"
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
            <span aria-hidden className="flex size-swatch shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-card">
              {url ? <Image src={url} alt="" width={80} height={80} unoptimized className="size-full object-cover" /> : <ImageIcon className="size-icon-lg text-muted-foreground" />}
            </span>
          )}
        />
      );
    case "timeSlots":
      return <TimeSlotsField name={field.name} initial={value} invalid={invalid} />;
    case "multiSelect":
      return <MultiSelectField name={field.name} label={field.label} options={field.options ?? []} initial={value} />;
    case "switch":
      return <Switch {...common} defaultChecked={value === "on"} />;
    case "select":
      return (
        <Select name={field.name} defaultValue={value || undefined} onValueChange={(next) => onSelect(field.name, next)}>
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
}

/**
 * The entry screen of a master-data record: a normal page (own URL, back button), not a sheet. Save is the one fixed
 * action at the bottom; once saved, the person goes back to the list they came from, which is refreshed to show the change.
 */
export function ResourceForm({ itemId, fields, values, backHref, saveAction, deleteItem, lead }: ResourceFormProps) {
  const t = useTranslations("admin.common");
  const tv = useTranslations("admin.validation");
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(saveAction, IDLE_STATE);
  // The value of each select, followed live: a field can depend on another (the combo's items depend on its brand).
  const [selected, setSelected] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.filter((field) => field.kind === "select").map((field) => [field.name, values[field.name] ?? ""])),
  );

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

  const fieldErrors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  // After a failed save, start from what the user typed; otherwise from the saved record.
  const typed = state.status === "error" ? state.values : undefined;
  const formError = state.status === "error" && state.error !== "validation" ? state.error : null;
  const lastTypingField = fields.findLast((field) => !["switch", "color", "select", "textarea", "multiSelect", "image", "timeSlots"].includes(field.kind))?.name;

  // noValidate on the form: the server validates and returns translated messages, so the browser must not show its own.
  return (
    <form action={formAction} noValidate className="flex flex-1 flex-col gap-field">
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

      {/* Room for the fixed Save button, so the last field can scroll clear of it. */}
      <div aria-hidden className="h-action-clear shrink-0" />

      {/* Fixed to the bottom, in thumb reach. It stays while the keyboard is open: on the installed app the keyboard shrinks the page, so
          the bar rides just above it and Save is always reachable while typing (unlike the menu and the list's Add button, which hide). */}
      <div data-save-bar className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-inset pb-(--inset-bottom) md:left-64">
        <div className="mx-auto flex max-w-form items-center gap-stack">
          {deleteItem ? <DeleteRecordButton id={deleteItem.id} name={deleteItem.name} backHref={backHref} removeAction={deleteItem.removeAction} /> : null}
          <Button type="submit" size="cta" disabled={isPending} className="pointer-events-auto min-w-0 flex-1">
            {isPending ? (
              <>
                <LoaderCircle className="motion-safe:animate-spin" aria-hidden />
                {t("saving")}
              </>
            ) : (
              t("save")
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
