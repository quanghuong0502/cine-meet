"use client";

import { FileUp, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { RequiredMark } from "@/components/required-mark";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ImportState } from "@/app/admin/movies/actions";

interface Props {
  backHref: string;
  action: (previous: ImportState, formData: FormData) => Promise<ImportState>;
}

/** Paste CSV text or pick a file (read in the browser into the box); nothing is created unless every line is right. */
export function ShowtimeImportForm({ backHref, action }: Props) {
  const t = useTranslations("admin.movies.import");
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(action, { status: "idle" } as ImportState);
  const [text, setText] = useState("");
  const [lastText, setLastText] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // A failed import keeps what was typed (the form is cleared after every action).
  if (state.status === "error" && state.text !== lastText) {
    setLastText(state.text);
    setText(state.text);
  }

  useEffect(() => {
    if (state.status !== "success") return;
    toast.success(t("done", { count: state.created }));
    router.replace(backHref);
  }, [state, t, router, backHref]);

  async function readFile(file: File | undefined) {
    if (!file) return;
    setText(await file.text());
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <form action={formAction} noValidate className="flex flex-1 flex-col gap-field">
      <div className="flex flex-col gap-3">
        <Label htmlFor="csv" className="text-muted-foreground">
          <span>
            {t("csv")}
            <RequiredMark />
          </span>
        </Label>
        <Textarea
          id="csv"
          name="csv"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder={"movie,branch,auditorium,start,format,price\nMai,CGV Vincom,Phòng 1,2026-12-01 19:30,2D,90000"}
          className="max-h-72 min-h-48 resize-y rounded-xl bg-card px-4 py-3 font-mono text-base"
        />
        <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => void readFile(e.target.files?.[0])} />
        <Button type="button" variant="secondary" size="cta" onClick={() => fileRef.current?.click()}>
          <FileUp aria-hidden />
          {t("pickFile")}
        </Button>
      </div>

      {state.status === "error" ? (
        <div role="alert" className="flex flex-col gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <p className="font-semibold">{t("errorsTitle", { count: state.errors.length })}</p>
          <ul className="flex flex-col gap-1">
            {state.errors.slice(0, 50).map((error) => (
              <li key={`${error.line}-${error.code}`}>{t(`errors.${error.code}`, { line: error.line, value: error.value ?? "" })}</li>
            ))}
          </ul>
          {state.errors.length > 50 ? <p>{t("moreErrors", { count: state.errors.length - 50 })}</p> : null}
        </div>
      ) : null}

      <div aria-hidden className="h-[calc(var(--spacing-control)+2.5rem)] shrink-0" />
      <div data-save-bar className="pointer-events-none fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-background via-background to-transparent px-4 pt-6 pb-[max(1rem,env(safe-area-inset-bottom))] md:left-64">
        <div className="mx-auto flex max-w-sm">
          <Button type="submit" size="cta" disabled={isPending || text.trim() === ""} className="pointer-events-auto min-w-0 flex-1">
            {isPending ? (
              <>
                <LoaderCircle className="motion-safe:animate-spin" aria-hidden />
                {t("importing")}
              </>
            ) : (
              t("submit")
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
