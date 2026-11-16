"use client";

import { LoaderCircle, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
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

export type ResourceFieldKind = "text" | "textarea" | "url" | "color" | "number" | "select" | "switch" | "date";

/** One form field. All text is already translated by the server page, so this component holds no entity wording. */
export interface ResourceField {
  name: string;
  kind: ResourceFieldKind;
  label: string;
  hint?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  /** For number fields. */
  step?: string;
  min?: number;
  max?: number;
  maxLength?: number;
}

export interface ResourceItem {
  id: string;
  title: string;
  subtitle?: string;
  meta?: string[];
  /** Brand colour dot, as #rrggbb. */
  color?: string;
  /** Current values by field name, as the form needs them (strings; a checked switch is "on"). */
  values: Record<string, string>;
}

export interface ResourceLabels {
  addButton: string;
  createTitle: string;
  editTitle: string;
  emptyTitle: string;
  emptyDescription: string;
}

interface ResourceManagerProps {
  items: ResourceItem[];
  fields: ResourceField[];
  /** Current search term from the URL. */
  query: string;
  labels: ResourceLabels;
  saveAction: (previous: SaveState, formData: FormData) => Promise<SaveState>;
  removeAction: (id: string) => Promise<RemoveResult>;
}

function isValidationCode(code: string): code is ValidationCode {
  return VALIDATION_CODES.some((known) => known === code);
}

const CONTROL_CLASS = "h-control rounded-xl bg-card px-4 text-base";

function FieldControl({ field, value, invalid }: { field: ResourceField; value: string; invalid: boolean }) {
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
            <SelectValue />
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
          inputMode={field.kind === "number" ? "decimal" : undefined}
          step={field.step}
          min={field.min}
          max={field.max}
          maxLength={field.maxLength}
          autoCapitalize={field.kind === "url" ? "none" : undefined}
          defaultValue={value}
          className={CONTROL_CLASS}
        />
      );
  }
}

interface ResourceFormProps {
  item: ResourceItem | null;
  fields: ResourceField[];
  saveAction: ResourceManagerProps["saveAction"];
  onDone: () => void;
  onCancel: () => void;
}

function ResourceForm({ item, fields, saveAction, onDone, onCancel }: ResourceFormProps) {
  const t = useTranslations("admin.common");
  const tv = useTranslations("admin.validation");
  const [state, formAction, isPending] = useActionState(saveAction, IDLE_STATE);

  useEffect(() => {
    if (state.status !== "success") return;
    toast.success(t("saved"));
    onDone();
  }, [state, t, onDone]);

  const fieldErrors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  // After a failed save, start from what the user typed; otherwise from the saved record.
  const typed = state.status === "error" ? state.values : undefined;
  const formError = state.status === "error" && state.error !== "validation" ? state.error : null;

  // noValidate on the form: the server validates and returns translated messages, so the browser must not show its own.
  return (
    <form action={formAction} noValidate className="flex min-h-0 flex-1 flex-col gap-4">
      {item ? <input type="hidden" name="id" value={item.id} /> : null}

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-2">
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
                value={typed ? (typed[field.name] ?? "") : (item?.values[field.name] ?? "")}
                invalid={Boolean(code)}
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
      </div>

      <div className="flex flex-col gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button type="submit" disabled={isPending} className="h-control w-full rounded-full text-base font-semibold">
          {isPending ? (
            <>
              <LoaderCircle className="motion-safe:animate-spin" aria-hidden />
              {t("saving")}
            </>
          ) : (
            t("save")
          )}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} className="h-target w-full rounded-full text-base">
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}

type DialogState = { mode: "create" } | { mode: "edit"; item: ResourceItem } | null;

/**
 * Admin list + create/edit/delete for one master-data type. Cards on phones, grid on wider screens;
 * the form opens in a bottom sheet; delete asks for confirmation. Every text comes in as props (already translated).
 */
export function ResourceManager({ items, fields, query, labels, saveAction, removeAction }: ResourceManagerProps) {
  const t = useTranslations("admin.common");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [term, setTerm] = useState(query);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [pendingDelete, setPendingDelete] = useState<ResourceItem | null>(null);
  const [isDeleting, startDeleting] = useTransition();

  // Search runs on the server (the term lives in the URL), after a short pause in typing.
  useEffect(() => {
    if (term.trim() === query) return;
    const timer = setTimeout(() => {
      // Keep the other URL parameters (such as the selected tab) and only change `q`.
      const params = new URLSearchParams(searchParams.toString());
      if (term.trim()) params.set("q", term.trim());
      else params.delete("q");
      router.replace(params.size ? `${pathname}?${params}` : pathname);
    }, 300);
    return () => clearTimeout(timer);
  }, [term, query, pathname, router, searchParams]);

  const closeDialog = () => setDialog(null);
  const hasSearch = query !== "";

  function confirmDelete() {
    const target = pendingDelete;
    if (!target) return;
    startDeleting(async () => {
      const result = await removeAction(target.id);
      setPendingDelete(null);
      if (result.ok) toast.success(t("deleted"));
      else toast.error(t(`errors.${result.error}`));
    });
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchLabel")}
          className={`${CONTROL_CLASS} pl-11`}
        />
      </div>

      {items.length === 0 ? (
        <EmptyState
          mascot="bubu-sleepy"
          title={hasSearch ? t("noResultsTitle") : labels.emptyTitle}
          description={hasSearch ? t("noResultsDescription") : labels.emptyDescription}
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{t("itemCount", { count: items.length })}</p>
          <ul className="grid gap-3 md:grid-cols-2">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-1 rounded-xl border bg-card pr-1">
                <button
                  type="button"
                  onClick={() => setDialog({ mode: "edit", item })}
                  className="flex min-h-row min-w-0 flex-1 items-center gap-3 rounded-xl p-3 text-left"
                >
                  <span
                    aria-hidden
                    className="size-10 shrink-0 rounded-full border bg-muted"
                    style={item.color ? { backgroundColor: item.color } : undefined}
                  />
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="truncate text-base font-semibold">{item.title}</span>
                    {item.subtitle ? <span className="truncate text-sm text-muted-foreground">{item.subtitle}</span> : null}
                    {item.meta?.length ? (
                      <span className="flex flex-wrap gap-1">
                        {item.meta.map((entry) => (
                          <Badge key={entry} variant="secondary" className="text-xs font-medium">
                            {entry}
                          </Badge>
                        ))}
                      </span>
                    ) : null}
                  </span>
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setDialog({ mode: "edit", item })}
                  aria-label={`${t("edit")}: ${item.title}`}
                  className="size-target shrink-0 text-muted-foreground"
                >
                  <Pencil aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setPendingDelete(item)}
                  aria-label={`${t("delete")}: ${item.title}`}
                  className="size-target shrink-0 text-muted-foreground"
                >
                  <Trash2 aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Room for the fixed button below, so the last item can scroll clear of it. */}
      <div aria-hidden className="h-[calc(var(--spacing-control)+2.5rem)] shrink-0" />

      {/* Primary action: fixed above the bottom menu (not inside the flow), so it stays in thumb reach, at the same
          place whether the list is empty, short or long. On wide screens it starts after the sidebar. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[var(--bottom-nav-h,0px)] z-30 bg-gradient-to-t from-background via-background to-transparent px-4 pt-6 pb-4 md:left-64">
        <Button type="button" onClick={() => setDialog({ mode: "create" })} className="pointer-events-auto mx-auto flex h-control w-full max-w-sm rounded-full text-base font-semibold">
          <Plus aria-hidden />
          {labels.addButton}
        </Button>
      </div>

      <Drawer open={dialog !== null} onOpenChange={(open) => (open ? undefined : closeDialog())}>
        <DrawerContent className="max-h-[92dvh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>{dialog?.mode === "edit" ? labels.editTitle : labels.createTitle}</DrawerTitle>
            <DrawerDescription className="sr-only">
              {dialog?.mode === "edit" ? labels.editTitle : labels.createTitle}
            </DrawerDescription>
          </DrawerHeader>
          {dialog ? (
            <ResourceForm
              key={dialog.mode === "edit" ? dialog.item.id : "new"}
              item={dialog.mode === "edit" ? dialog.item : null}
              fields={fields}
              saveAction={saveAction}
              onDone={closeDialog}
              onCancel={closeDialog}
            />
          ) : null}
        </DrawerContent>
      </Drawer>

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => (open ? undefined : setPendingDelete(null))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle", { name: pendingDelete?.title ?? "" })}</AlertDialogTitle>
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
    </div>
  );
}
