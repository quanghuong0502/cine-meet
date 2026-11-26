import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { Be_Vietnam_Pro } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { KeyboardWatcher } from "@/components/keyboard-watcher";
import { NetworkWatcher } from "@/components/network-watcher";
import { NoZoom } from "@/components/no-zoom";
import { pickMessages, ROOT_CLIENT_NAMESPACES } from "@/components/scoped-intl-provider";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { APP_NAME } from "@/components/wordmark";
import splashScreens from "@/lib/splash-screens.json";
import { getBrandTheme } from "@/services/brand-theme-cache";
import "./globals.css";

const beVietnamPro = Be_Vietnam_Pro({
  variable: "--font-sans",
  subsets: ["vietnamese", "latin"],
  weight: ["400", "500", "600"],
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
    // startupImage: the launch screens made by `npm run splash:generate` (iOS ignores the manifest's background colour and
    // would show a white screen). Each one is matched to a phone by exact size, so a phone not in the list just opens as before.
    appleWebApp: {
      capable: true,
      title: APP_NAME,
      statusBarStyle: "black",
      startupImage: splashScreens.devices.map(({ width, height, ratio }) => ({
        url: `/splash/splash-${width * ratio}x${height * ratio}.png`,
        media: `(device-width: ${width}px) and (device-height: ${height}px) and (-webkit-device-pixel-ratio: ${ratio}) and (orientation: portrait)`,
      })),
    },
    formatDetection: { telephone: false },
    // Next only writes `mobile-web-app-capable`; iOS's launch screens are documented against the Apple-prefixed name, so both are present.
    other: { "apple-mobile-web-app-capable": "yes" },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const { theme } = await getBrandTheme();
  return {
    width: "device-width",
    initialScale: 1,
    // No zoom by any means (docs: .claude/rules/devices.md). iOS Safari ignores these two, see <NoZoom /> and touch-action in globals.css.
    maximumScale: 1,
    userScalable: false,
    viewportFit: "cover",
    colorScheme: "dark",
    // Same colour as the page background (the dark theme's, from the brand hue) so the status bar and Dynamic Island blend in.
    themeColor: theme.themeColorHex,
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [locale, brand, messages] = await Promise.all([getLocale(), getBrandTheme(), getMessages()]);
  const rootMessages = pickMessages(messages as Record<string, unknown>, ROOT_CLIENT_NAMESPACES);
  const DevDomRecorder =
    process.env.NODE_ENV !== "production" ? (await import("@/components/dev/dom-recorder")).DomRecorder : null;

  return (
    // Dark mode is the default: the `dark` class activates the shadcn dark tokens.
    // The inline background is the app's own (same as theme-color and the manifest): before the stylesheet has loaded the page
    // would otherwise flash white.
    <html lang={locale} className={`${beVietnamPro.variable} dark h-full antialiased`} style={{ backgroundColor: brand.theme.themeColorHex }}>
      {/* The brand colour variables, set before the first paint (numbers only, built and validated in src/lib/brand-theme.ts). */}
      <head>
        <link rel="preconnect" href="https://res.cloudinary.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://res.cloudinary.com" />
        <style dangerouslySetInnerHTML={{ __html: brand.css }} />
      </head>
      <body className="min-h-full bg-background text-foreground">
        <NextIntlClientProvider messages={rootMessages}>
          <NoZoom />
          <KeyboardWatcher />
          <NetworkWatcher />
          <ServiceWorkerRegister />
          {children}
          <Toaster theme="dark" />
          {DevDomRecorder ? <DevDomRecorder /> : null}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
