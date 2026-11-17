import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ProfileEditScreen } from "@/components/profile-edit-screen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("profile");
  return { title: t("editTitle") };
}

export default function EditProfilePage() {
  return <ProfileEditScreen backHref="/profile" />;
}
