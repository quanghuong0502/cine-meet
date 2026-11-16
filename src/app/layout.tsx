import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Be_Vietnam_Pro } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { DevAgent } from "@/components/dev-agent";
import { DevAuditButton } from "@/components/dev-audit-button";
import { KeyboardWatcher } from "@/components/keyboard-watcher";
import { NetworkWatcher } from "@/components/network-watcher";
import { NoZoom } from "@/components/no-zoom";
import { BootSplash } from "@/components/route-loading";
import { APP_NAME } from "@/components/wordmark";
import "./globals.css";

const beVietnamPro = Be_Vietnam_Pro({
  variable: "--font-sans",
  subsets: ["vietnamese", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: {
      default: APP_NAME,
      template: `%s · ${APP_NAME}`,
    },
    description: t("description"),
    applicationName: APP_NAME,
    // iOS home-screen app: opaque black status bar (the app is dark), so content starts below it.
    // The apple-touch-icon comes from src/app/apple-icon.png.
    appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "black" },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // No zoom by any means (docs: .claude/rules/devices.md). iOS Safari ignores these two, see <NoZoom /> and touch-action in globals.css.
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  colorScheme: "dark",
  // Same colour as the page background so the status bar and Dynamic Island blend in.
  themeColor: "#13080d",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();

  return (
    // Dark mode is the default: the `dark` class activates the shadcn dark tokens.
    <html lang={locale} className={`${beVietnamPro.variable} dark h-full antialiased`}>
      <body className="min-h-full bg-background text-foreground">
        <NextIntlClientProvider>
          <NoZoom />
          <KeyboardWatcher />
          <NetworkWatcher />
          <BootSplash />
          {children}
          <Toaster theme="dark" />
          {process.env.NODE_ENV !== "production" ? (
            <>
              <DevAuditButton />
              <DevAgent />
            </>
          ) : null}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
