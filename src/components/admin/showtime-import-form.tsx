"use client";

import { DownloadMinimalisticIcon, LoaderIcon, UploadMinimalisticIcon } from "@solar-icons/react/line-duotone";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { RequiredMark } from "@/components/required-mark";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ImportState } from "@/app/admin/movies/actions";

const CSV_HEADER = "movie,branch,auditorium,start,format,price";
const CSV_SAMPLE = `${CSV_HEADER}\nMai,CGV Vincom,Phòng 1,2026-12-01 19:30,2D,90000\n`;

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

  const rowCount = useMemo(() => {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length === 0) return 0;
    const first = lines[0].toLowerCase().replace(/\s+/g, "");
    return first.startsWith("movie,") ? lines.length - 1 : lines.length;
  }, [text]);

  async function readFile(file: File | undefined) {
    if (!file) return;
    setText(await file.text());
    if (fileRef.current) fileRef.current.value = "";
  }

  function downloadTemplate() {
    const blob = new Blob([CSV_SAMPLE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "showtimes-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <form action={formAction} noValidate className="flex flex-1 flex-col gap-field">
      <div className="flex flex-col gap-stack rounded-xl border bg-card p-inset-sm">
        <span className="type-label text-muted-foreground">{t("columnsLabel")}</span>
        <code className="break-all font-mono type-secondary">{CSV_HEADER}</code>
        <Button type="button" variant="outline" size="cta-sm" onClick={downloadTemplate} className="w-auto self-start px-inset">
          <DownloadMinimalisticIcon aria-hidden />
          {t("downloadTemplate")}
        </Button>
      </div>

      <div className="flex flex-col gap-item">
        <div className="flex items-baseline justify-between gap-item">
          <Label htmlFor="csv" className="text-muted-foreground">
            <span>
              {t("csv")}
              <RequiredMark />
            </span>
          </Label>
          {rowCount > 0 ? (
            <span className="type-secondary text-muted-foreground tabular-nums">{t("rowCount", { count: rowCount })}</span>
          ) : null}
        </div>
        <Textarea
          id="csv"
          name="csv"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder={CSV_SAMPLE.trim()}
          className="max-h-area-max min-h-area-lg resize-y rounded-xl bg-card px-inset py-inset-sm font-mono type-body"
        />
        <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => void readFile(e.target.files?.[0])} />
        <Button type="button" variant="secondary" size="cta" onClick={() => fileRef.current?.click()}>
          <UploadMinimalisticIcon aria-hidden />
          {t("pickFile")}
        </Button>
      </div>

      {state.status === "error" ? (
        <div role="alert" className="flex flex-col gap-stack rounded-xl border border-destructive/30 bg-destructive/10 px-inset py-inset-sm type-secondary text-destructive">
          <p className="font-semibold">{t("errorsTitle", { count: state.errors.length })}</p>
          <ul className="flex flex-col gap-tight">
            {state.errors.slice(0, 50).map((error) => (
              <li key={`${error.line}-${error.code}`}>{t(`errors.${error.code}`, { line: error.line, value: error.value ?? "" })}</li>
            ))}
          </ul>
          {state.errors.length > 50 ? <p>{t("moreErrors", { count: state.errors.length - 50 })}</p> : null}
        </div>
      ) : null}

      <div aria-hidden className="h-save-clear shrink-0" />
      <div data-save-bar className="pointer-events-none fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-background via-background/95 to-transparent px-inset pt-group pb-(--inset-bottom) md:left-sidebar">
        <div className="mx-auto flex max-w-form">
          <Button type="submit" size="cta" disabled={isPending} className="pointer-events-auto min-w-0 flex-1">
            {isPending ? (
              <>
                <LoaderIcon className="motion-safe:animate-spin" aria-hidden />
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
