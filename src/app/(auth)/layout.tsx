import { ScopedIntlProvider } from "@/components/scoped-intl-provider";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <ScopedIntlProvider namespaces={["auth"]}>{children}</ScopedIntlProvider>;
}
