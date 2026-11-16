import type { Metadata, Viewport } from "next";
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

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s · ${APP_NAME}`,
  },
  description:
    "Lập kế hoạch xem phim cùng bạn bè, ghi nhớ ghế đẹp ở từng phòng chiếu, chia tiền và theo dõi chi tiêu.",
  applicationName: APP_NAME,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Dark mode is the default: the `dark` class activates the shadcn dark tokens.
    <html lang="vi" className={`${beVietnamPro.variable} dark h-full antialiased`}>
      <body className="min-h-full bg-background text-foreground">
        {children}
        <Toaster theme="dark" />
      </body>
    </html>
  );
}
