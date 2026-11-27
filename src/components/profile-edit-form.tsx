"use client";

import { LoaderIcon } from "@solar-icons/react/line-duotone";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { saveProfileAction } from "@/actions/profile";
import { ChoiceGroup } from "@/components/admin/auditorium-editor/chips";
import { UploadBusyContext } from "@/components/image-upload";
import { RequiredMark } from "@/components/required-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IDLE_STATE, VALIDATION_CODES, type SaveState, type ValidationCode } from "@/lib/admin/action-result";
import { cn } from "@/lib/utils";

function isValidationCode(code: string): code is ValidationCode {
  return VALIDATION_CODES.some((known) => known === code);
}

interface ProfileEditFormProps {
  initial: {
    name: string;
    phone: string;
    seatPreference: string;
  };
  seatOptions: { value: string; label: string }[];
  backHref: string;
  hasSidebar?: boolean;
  lead: ReactNode;
}

const CONTROL_CLASS = "h-control rounded-xl bg-card px-inset type-body";

/**
 * Lightweight dedicated form for `/profile/edit` & `/admin/profile/edit`:
 * avoids pulling the kitchen-sink admin `ResourceForm` (`radix-select`, `ComboItemsField`, `TimeSlotsField`, `DeleteRecordButton`).
 */
export function ProfileEditForm({ initial, seatOptions, backHref, hasSidebar = false, lead }: ProfileEditFormProps) {
  const tp = useTranslations("profile");
  const t = useTranslations("admin.common");
  const tv = useTranslations("admin.validation");
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [phone, setPhone] = useState(initial.phone);
  const [seatPreference, setSeatPreference] = useState(initial.seatPreference);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const [uploadingCount, setUploadingCount] = useState(0);
  const uploading = uploadingCount > 0;
  const onBusyChange = useCallback((busy: boolean) => setUploadingCount((n) => Math.max(0, n + (busy ? 1 : -1))), []);

  const errorText = (field: string) => {
    const code = fieldErrors[field];
    return code ? tv(isValidationCode(code) ? code : "invalid") : undefined;
  };

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData();
    formData.set("name", name);
    formData.set("phone", phone);
    formData.set("seatPreference", seatPreference);
    startTransition(async () => {
      const result: SaveState | null = await saveProfileAction(IDLE_STATE, formData).catch(() => null);
      if (!result) {
        toast.error(t("errors.network"));
        return;
      }
      if (result.status === "success") {
        toast.success(t("saved"));
        router.replace(backHref);
        return;
      }
      if (result.status === "error") {
        setFieldErrors(result.fieldErrors ?? {});
        if (result.error !== "validation") toast.error(t(`errors.${result.error}`));
      }
    });
  }

  return (
    <UploadBusyContext.Provider value={onBusyChange}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-1 flex-col gap-field">
        {lead}

        <div className="flex flex-col gap-item">
          <Label htmlFor="name" className="text-muted-foreground">
            <span>
              {tp("fields.name.label")}
              <RequiredMark />
            </span>
          </Label>
          <Input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            enterKeyHint="next"
            required
            aria-required
            maxLength={80}
            value={name}
            disabled={isPending}
            onChange={(e) => {
              setName(e.target.value);
              if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: "" }));
            }}
            aria-invalid={Boolean(errorText("name")) || undefined}
            className={CONTROL_CLASS}
          />
          {errorText("name") ? (
            <p role="alert" className="type-secondary text-destructive">
              {errorText("name")}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-item">
          <Label htmlFor="phone" className="text-muted-foreground">
            {tp("fields.phone.label")}
          </Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            enterKeyHint="done"
            maxLength={20}
            placeholder={tp("fields.phone.placeholder")}
            value={phone}
            disabled={isPending}
            onChange={(e) => {
              setPhone(e.target.value);
              if (fieldErrors.phone) setFieldErrors((prev) => ({ ...prev, phone: "" }));
            }}
            aria-invalid={Boolean(errorText("phone")) || undefined}
            className={CONTROL_CLASS}
          />
          {errorText("phone") ? (
            <p role="alert" className="type-secondary text-destructive">
              {errorText("phone")}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-item">
          <Label className="text-muted-foreground">{tp("fields.seatPreference.label")}</Label>
          <input type="hidden" name="seatPreference" value={seatPreference} />
          <ChoiceGroup
            label={tp("fields.seatPreference.label")}
            value={seatPreference}
            options={seatOptions}
            onChange={setSeatPreference}
          />
        </div>

        <div aria-hidden className="h-save-clear shrink-0" />

        <div
          data-save-bar
          className={cn(
            "pointer-events-none fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-background via-background/95 to-transparent px-inset pt-group pb-(--inset-bottom)",
            hasSidebar && "md:left-sidebar",
          )}
        >
          <div className="mx-auto flex max-w-form items-center gap-stack">
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
