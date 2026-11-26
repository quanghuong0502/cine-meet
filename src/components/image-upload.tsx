"use client";

import { CameraIcon, LoaderIcon, TrashBinMinimalisticIcon } from "@solar-icons/react/line-duotone";
import { useTranslations } from "next-intl";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { TicketResult } from "@/lib/upload-types";

const MAX_BYTES = 8 * 1024 * 1024;

/**
 * A form that holds an upload provides this so it can keep Save off while a picture is still going up: until Cloudinary answers, the
 * hidden input still carries the old address, so saving then would silently keep the old picture.
 */
export const UploadBusyContext = createContext<((busy: boolean) => void) | null>(null);

interface ImageUploadProps {
  /** Name of the hidden input that carries the picture's address into the form. */
  name: string;
  initialUrl?: string;
  /** A server action that returns a signed Cloudinary ticket for this kind of picture. */
  getTicket: () => Promise<TicketResult>;
  /** How the current picture (or its absence) looks. */
  preview: (url: string) => React.ReactNode;
}

/**
 * Picks a picture on the device and sends it straight to Cloudinary with a one-time signature from the server (the secret
 * never reaches the browser). It only fills a hidden input: the picture belongs to the record when the form is saved.
 */
export function ImageUpload({ name, initialUrl, getTicket, preview }: ImageUploadProps) {
  const t = useTranslations("imageUpload");
  const [url, setUrl] = useState(initialUrl ?? "");
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const reportBusy = useContext(UploadBusyContext);

  useEffect(() => {
    if (!uploading) return;
    reportBusy?.(true);
    return () => reportBusy?.(false);
  }, [uploading, reportBusy]);

  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview]);

  async function upload(file: File) {
    if (!file.type.startsWith("image/")) return toast.error(t("errors.notImage"));
    if (file.size > MAX_BYTES) return toast.error(t("errors.tooBig"));

    const objectUrl = URL.createObjectURL(file);
    setLocalPreview(objectUrl);
    setUploading(true);
    try {
      const signed = await getTicket();
      if (!signed.ok) return toast.error(t(`errors.${signed.error}`));

      const body = new FormData();
      for (const [key, value] of Object.entries(signed.ticket.fields)) body.append(key, value);
      body.append("file", file);
      const response = await fetch(signed.ticket.uploadUrl, { method: "POST", body });
      const result = (await response.json().catch(() => null)) as { secure_url?: string } | null;
      if (!response.ok || !result?.secure_url) return toast.error(t("errors.failed"));
      setUrl(result.secure_url);
    } catch {
      // No network: the form keeps everything typed, only the picture is not sent.
      toast.error(t("errors.network"));
    } finally {
      setUploading(false);
      setLocalPreview(null);
      URL.revokeObjectURL(objectUrl);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex items-end gap-group">
      <input type="hidden" name={name} value={url} />
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        aria-label={t(url ? "change" : "choose")}
        className="relative shrink-0 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:opacity-80 disabled:pointer-events-none"
      >
        {preview(localPreview ?? url)}
        {uploading ? (
          <span aria-hidden className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/60">
            <LoaderIcon className="size-icon text-foreground motion-safe:animate-spin" />
          </span>
        ) : null}
      </button>
      <div className="flex min-w-0 flex-wrap gap-stack">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          aria-label={t("choose")}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <Button type="button" variant="outline" size="cta-sm" disabled={uploading} onClick={() => inputRef.current?.click()} className="w-auto px-inset">
          {uploading ? <LoaderIcon className="motion-safe:animate-spin" aria-hidden /> : <CameraIcon aria-hidden />}
          {uploading ? t("uploading") : t(url ? "change" : "choose")}
        </Button>
        {url && !uploading ? (
          <Button type="button" variant="ghost" size="cta-sm" onClick={() => setUrl("")} className="w-auto px-inset text-muted-foreground">
            <TrashBinMinimalisticIcon aria-hidden />
            {t("remove")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
