import { ScopedIntlProvider } from "@/components/scoped-intl-provider";

export default function AppointmentsLayout({ children }: { children: React.ReactNode }) {
  return (
    <ScopedIntlProvider namespaces={["appointments", "showtimes", "seatMap", "dateTimeField"]}>
      {children}
    </ScopedIntlProvider>
  );
}
