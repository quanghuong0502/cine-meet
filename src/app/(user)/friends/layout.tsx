import { ScopedIntlProvider } from "@/components/scoped-intl-provider";

export default function FriendsLayout({ children }: { children: React.ReactNode }) {
  return <ScopedIntlProvider namespaces={["friends"]}>{children}</ScopedIntlProvider>;
}
