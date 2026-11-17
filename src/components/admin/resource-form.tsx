"use client";

import { LoaderCircle, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
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

const CONTROL_CLASS = "h-control rounded-xl bg-card px-4 text-base";

/** `last`: the final typing field of the form, whose return key says "Done" instead of "Next". */
function FieldControl({ field, value, invalid, last }: { field: ResourceField; value: string; invalid: boolean; last: boolean }) {
  const common = { id: field.name, name: field.name, "aria-invalid": invalid || undefined } as const;

  switch (field.kind) {
    case "textarea":
      return <Textarea {...common} defaultValue={value} maxLength={field.maxLength} rows={3} className="rounded-xl bg-card px-4 py-3 text-base" />;
    case "color":
      return (
        <input
          {...common}
          type="color"
          defaultValue={value || "#c61583"}
          className="h-control w-20 cursor-pointer rounded-xl border bg-card p-1"
        />
      );
    case "switch":
      return <Switch {...common} defaultChecked={value === "on"} />;
    case "select":
      return (
        <Select name={field.name} defaultValue={value || undefined}>
          <SelectTrigger id={field.name} aria-invalid={invalid || undefined} className={`${CONTROL_CLASS} w-full`}>
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
          type={field.kind === "url" ? "url" : field.kind === "number" ? "number" : field.kind === "date" ? "date" : "text"}
          inputMode={field.kind === "number" ? (field.step === "1" ? "numeric" : "decimal") : undefined}
          step={field.step}
          min={field.min}
          max={field.max}
          maxLength={field.maxLength}
          autoCapitalize={field.kind === "url" ? "none" : undefined}
          autoCorrect={field.kind === "url" ? "off" : undefined}
          spellCheck={field.kind === "url" ? false : undefined}
          enterKeyHint={last ? "done" : "next"}
          // Off: otherwise iOS guesses a contact field and offers "AutoFill Contact" above the keyboard.
          autoComplete="off"
          defaultValue={value}
          className={CONTROL_CLASS}
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
  /** Name shown in the delete confirmation. */
  itemName?: string;
  saveAction: (previous: SaveState, formData: FormData) => Promise<SaveState>;
  removeAction?: (id: string) => Promise<RemoveResult>;
}

/**
 * The entry screen of a master-data record: a normal page (own URL, back button), not a sheet. Save is the one fixed
 * action at the bottom; once saved, the person goes back to the list they came from, which is refreshed to show the change.
 */
export function ResourceForm({ itemId, fields, values, backHref, itemName, saveAction, removeAction }: ResourceFormProps) {
  const t = useTranslations("admin.common");
  const tv = useTranslations("admin.validation");
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(saveAction, IDLE_STATE);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isDeleting, startDeleting] = useTransition();

  useEffect(() => {
    if (state.status !== "success") return;
    // The toast lives in the root layout, so it survives the move back to the list.
    toast.success(t("saved"));
    router.replace(backHref);
    router.refresh();
  }, [state, t, router, backHref]);

  // A long form can hide the field that failed: scroll to the first one (no focus, so the keyboard does not pop up).
  useEffect(() => {
    if (state.status !== "error") return;
    const target = document.querySelector<HTMLElement>('form [aria-invalid="true"]');
    target?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [state]);

  function confirmDelete() {
    if (!itemId || !removeAction) return;
    startDeleting(async () => {
      const result = await removeAction(itemId);
      setConfirmingDelete(false);
      if (result.ok) {
        toast.success(t("deleted"));
        router.replace(backHref);
        router.refresh();
      } else {
        toast.error(t(`errors.${result.error}`));
      }
    });
  }

  const fieldErrors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  // After a failed save, start from what the user typed; otherwise from the saved record.
  const typed = state.status === "error" ? state.values : undefined;
  const formError = state.status === "error" && state.error !== "validation" ? state.error : null;
  const lastTypingField = fields.findLast((field) => !["switch", "color", "select", "textarea"].includes(field.kind))?.name;

  // noValidate on the form: the server validates and returns translated messages, so the browser must not show its own.
  return (
    <form action={formAction} noValidate className="flex flex-1 flex-col gap-4">
      {itemId ? <input type="hidden" name="id" value={itemId} /> : null}

      {fields.map((field) => {
        const code = fieldErrors[field.name];
        const horizontal = field.kind === "switch";
        return (
          <div key={field.name} className={horizontal ? "flex min-h-target items-center justify-between gap-4" : "flex flex-col gap-2"}>
            <div className="flex flex-col gap-0.5">
              <Label htmlFor={field.name} className="text-muted-foreground">
                {field.label}
                {field.required ? null : <span className="ml-2 text-footnote font-normal">· {t("optional")}</span>}
              </Label>
              {field.hint ? <p className="text-footnote text-muted-foreground">{field.hint}</p> : null}
            </div>
            {/* key: remount with the typed value, since uncontrolled inputs ignore a changed defaultValue */}
            <FieldControl
              key={`${field.name}:${typed?.[field.name] ?? ""}`}
              field={field}
              value={typed ? (typed[field.name] ?? "") : (values[field.name] ?? "")}
              invalid={Boolean(code)}
              last={field.name === lastTypingField}
            />
            {code ? (
              <p role="alert" className="text-sm text-destructive">
                {tv(isValidationCode(code) ? code : "invalid")}
              </p>
            ) : null}
          </div>
        );
      })}

      {formError ? (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {t(`errors.${formError}`)}
        </p>
      ) : null}

      {/* Deleting is its own quiet action, away from Save, and always asks first. */}
      {itemId && removeAction ? (
        <Button type="button" variant="destructive" size="cta-sm" className="mt-4" onClick={() => setConfirmingDelete(true)}>
          <Trash2 aria-hidden />
          {t("delete")}
        </Button>
      ) : null}

      {/* Room for the fixed Save button, so the last field can scroll clear of it. */}
      <div aria-hidden className="h-[calc(var(--spacing-control)+2.5rem)] shrink-0" />

      {/* Fixed to the bottom, in thumb reach. It steps aside while the keyboard is open (data-bottom-fixed) and the keyboard's Done closes it. */}
      <div data-bottom-fixed className="pointer-events-none fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-background via-background to-transparent px-4 pt-6 pb-[max(1rem,env(safe-area-inset-bottom))] md:left-64">
        <Button type="submit" size="cta" disabled={isPending} className="pointer-events-auto mx-auto flex max-w-sm">
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

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle", { name: itemName ?? "" })}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              className="border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20"
              onClick={(event) => {
                event.preventDefault();
                confirmDelete();
              }}
            >
              {isDeleting ? <LoaderCircle className="motion-safe:animate-spin" aria-hidden /> : <Trash2 aria-hidden />}
              {isDeleting ? t("saving") : t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
