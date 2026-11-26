import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ProfileEditScreen } from "@/components/profile-edit-screen";
import { ADMIN_SHELL_NAMESPACES, ScopedIntlProvider } from "@/components/scoped-intl-provider";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("profile");
  return { title: t("editTitle") };
}

export default function AdminEditProfilePage() {
  return (
    <ScopedIntlProvider namespaces={[...ADMIN_SHELL_NAMESPACES, "profile", "imageUpload"]}>
      <ProfileEditScreen backHref="/admin/profile" hasSidebar />
    </ScopedIntlProvider>
  );
}
