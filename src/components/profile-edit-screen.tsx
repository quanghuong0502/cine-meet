import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { saveProfileAction } from "@/actions/profile";
import { ResourceForm } from "@/components/admin/resource-form";
import type { ResourceField } from "@/components/admin/resource-types";
import { AvatarUpload } from "@/components/avatar-upload";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/guards";
import { formatVietnamPhone } from "@/lib/phone";
import { SEAT_PREFERENCES } from "@/lib/user-constants";
import { getProfile } from "@/services/profile.service";

/** Edit screen of the Profile (user and admin share it): picture, name, phone, seat preference. */
export async function ProfileEditScreen({ backHref }: { backHref: string }) {
  const user = await requireUser();
  const [t, profile] = await Promise.all([getTranslations("profile"), getProfile(user.userId)]);
  if (!profile) notFound();

  const fields: ResourceField[] = [
    { name: "name", kind: "text", label: t("fields.name.label"), required: true, maxLength: 80 },
    { name: "phone", kind: "tel", label: t("fields.phone.label"), hint: t("fields.phone.hint"), placeholder: t("fields.phone.placeholder"), maxLength: 20 },
    {
      name: "seatPreference",
      kind: "select",
      label: t("fields.seatPreference.label"),
      hint: t("fields.seatPreference.hint"),
      placeholder: t("seat.any"),
      options: [{ value: "any", label: t("seat.any") }, ...SEAT_PREFERENCES.map((value) => ({ value, label: t(`seat.${value}`) }))],
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4">
      <PageHeader title={t("editTitle")} backHref={backHref} />
      <ResourceForm
        itemId={null}
        fields={fields}
        values={{
          name: profile.name,
          phone: profile.phone ? formatVietnamPhone(profile.phone) : "",
          seatPreference: profile.seatPreference ?? "any",
        }}
        backHref={backHref}
        saveAction={saveProfileAction}
        lead={<AvatarUpload name={profile.name} initialUrl={profile.avatar} />}
      />
    </div>
  );
}
