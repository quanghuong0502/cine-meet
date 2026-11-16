import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Be_Vietnam_Pro } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
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
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "dark",
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
          {children}
          <Toaster theme="dark" />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
