"use client";

import { Camera, LoaderCircle, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { getAvatarUploadTicket } from "@/actions/profile";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";

const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Picks a picture and sends it straight to Cloudinary with a one-time signature from the server (the secret never reaches
 * the browser). It only fills the hidden `avatar` field: the picture becomes the person's own when they press Save.
 */
export function AvatarUpload({ name, initialUrl }: { name: string; initialUrl?: string }) {
  const t = useTranslations("profile.avatar");
  const [url, setUrl] = useState(initialUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    if (!file.type.startsWith("image/")) return toast.error(t("errors.notImage"));
    if (file.size > MAX_BYTES) return toast.error(t("errors.tooBig"));

    setUploading(true);
    try {
      const signed = await getAvatarUploadTicket();
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
    <div className="flex items-center gap-4">
      <input type="hidden" name="avatar" value={url} />
      <UserAvatar name={name} image={url || undefined} size={80} />
      <div className="flex flex-col gap-2">
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
