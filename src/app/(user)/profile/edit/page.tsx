import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ProfileEditScreen } from "@/components/profile-edit-screen";
import { ScopedIntlProvider } from "@/components/scoped-intl-provider";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("profile");
  return { title: t("editTitle") };
}

export default function EditProfilePage() {
  return (
    <ScopedIntlProvider namespaces={["profile", "imageUpload", "admin.common", "admin.validation"]}>
      <ProfileEditScreen backHref="/profile" />
    </ScopedIntlProvider>
  );
}
