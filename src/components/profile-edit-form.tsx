"use client";

import { LoaderIcon } from "@solar-icons/react/line-duotone";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useActionState, useCallback, useEffect, useState, type ReactNode } from "react";
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
  const [state, action, isPending] = useActionState<SaveState, FormData>(saveProfileAction, IDLE_STATE);
  const [edited, setEdited] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [seatPreference, setSeatPreference] = useState(initial.seatPreference);
  const uploading = uploadingCount > 0;
  const onBusyChange = useCallback((busy: boolean) => setUploadingCount((n) => Math.max(0, n + (busy ? 1 : -1))), []);

  useEffect(() => {
    if (state.status === "success") {
      toast.success(t("saved"));
      router.replace(backHref);
    } else if (state.status === "error" && state.error !== "validation") {
      toast.error(t(`errors.${state.error}`));
    }
  }, [state, router, backHref, t]);

  const fieldErrors = state.status === "error" && !edited ? (state.fieldErrors ?? {}) : {};
  const echo = state.status === "error" ? state.values : undefined;
  const nameValue = echo?.name ?? initial.name;
  const phoneValue = echo?.phone ?? initial.phone;
  const errorText = (field: string) => {
    const code = fieldErrors[field];
    return code ? tv(isValidationCode(code) ? code : "invalid") : undefined;
  };

  return (
    <UploadBusyContext.Provider value={onBusyChange}>
      <form
        action={action}
        onSubmit={() => setEdited(false)}
        noValidate
        className="flex flex-1 flex-col gap-group pb-action-clear"
      >
        {lead}

        <div className="flex flex-col gap-stack">
          <Label htmlFor="name">
            {tp("fields.name.label")}
            <RequiredMark />
          </Label>
          <Input
            id="name"
            name="name"
            type="text"
            required
            maxLength={80}
            defaultValue={nameValue}
            onChange={() => setEdited(true)}
            aria-invalid={Boolean(errorText("name")) || undefined}
            className={CONTROL_CLASS}
          />
          {errorText("name") ? (
            <p role="alert" className="type-secondary text-destructive">
              {errorText("name")}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-stack">
          <Label htmlFor="phone">{tp("fields.phone.label")}</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            maxLength={20}
            placeholder={tp("fields.phone.placeholder")}
            defaultValue={phoneValue}
            onChange={() => setEdited(true)}
            aria-invalid={Boolean(errorText("phone")) || undefined}
            className={CONTROL_CLASS}
          />
          {errorText("phone") ? (
            <p role="alert" className="type-secondary text-destructive">
              {errorText("phone")}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-stack">
          <Label>{tp("fields.seatPreference.label")}</Label>
          <input type="hidden" name="seatPreference" value={seatPreference} />
          <ChoiceGroup
            label={tp("fields.seatPreference.label")}
            value={seatPreference}
            options={seatOptions}
            onChange={(next) => {
              setSeatPreference(next);
              setEdited(true);
            }}
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
