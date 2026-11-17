"use client";

import { Camera, LoaderCircle, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { TicketResult } from "@/lib/upload-types";

const MAX_BYTES = 8 * 1024 * 1024;

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
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    if (!file.type.startsWith("image/")) return toast.error(t("errors.notImage"));
    if (file.size > MAX_BYTES) return toast.error(t("errors.tooBig"));

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
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex items-end gap-4">
      <input type="hidden" name={name} value={url} />
      {preview(url)}
      {/* pb-1 = the padding between the preview frame and the picture inside it, so the buttons end level with the picture. */}
      <div className="flex min-w-0 flex-wrap gap-2 pb-1">
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
        <Button type="button" variant="outline" size="cta-sm" disabled={uploading} onClick={() => inputRef.current?.click()} className="w-auto px-4">
          {uploading ? <LoaderCircle className="motion-safe:animate-spin" aria-hidden /> : <Camera aria-hidden />}
          {uploading ? t("uploading") : t(url ? "change" : "choose")}
        </Button>
        {url && !uploading ? (
          <Button type="button" variant="ghost" size="cta-sm" onClick={() => setUrl("")} className="w-auto px-4 text-muted-foreground">
            <Trash2 aria-hidden />
            {t("remove")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
