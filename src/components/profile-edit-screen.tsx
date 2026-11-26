import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { AvatarUpload } from "@/components/avatar-upload";
import { PageHeader } from "@/components/page-header";
import { ProfileEditForm } from "@/components/profile-edit-form";
import { requireUser } from "@/lib/auth/guards";
import { formatVietnamPhone } from "@/lib/phone";
import { SEAT_PREFERENCES } from "@/lib/user-constants";
import { getProfile } from "@/services/profile.service";

/** Edit screen of the Profile (user and admin share it): picture, name, phone, seat preference. */
export async function ProfileEditScreen({ backHref, hasSidebar = false }: { backHref: string; hasSidebar?: boolean }) {
  const user = await requireUser();
  const [t, profile] = await Promise.all([getTranslations("profile"), getProfile(user.userId)]);
  if (!profile) notFound();

  const seatOptions = [
    { value: "any", label: t("seat.any") },
    ...SEAT_PREFERENCES.map((value) => ({ value, label: t(`seat.${value}`) })),
  ];

  return (
    <div className="mx-auto flex w-full max-w-page flex-1 flex-col gap-section p-inset">
      <PageHeader title={t("editTitle")} backHref={backHref} />
      <ProfileEditForm
        initial={{
          name: profile.name,
          phone: profile.phone ? formatVietnamPhone(profile.phone) : "",
          seatPreference: profile.seatPreference ?? "any",
        }}
        seatOptions={seatOptions}
        backHref={backHref}
        hasSidebar={hasSidebar}
        lead={<AvatarUpload name={profile.name} initialUrl={profile.avatar} />}
      />
    </div>
  );
}
