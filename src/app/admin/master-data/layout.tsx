import { ADMIN_SHELL_NAMESPACES, ScopedIntlProvider } from "@/components/scoped-intl-provider";

export default function AdminMasterDataLayout({ children }: { children: React.ReactNode }) {
  return (
    <ScopedIntlProvider namespaces={[...ADMIN_SHELL_NAMESPACES, "admin.masterData", "imageUpload", "dateTimeField"]}>
      {children}
    </ScopedIntlProvider>
  );
}
