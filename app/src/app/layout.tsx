import type { Metadata, Viewport } from "next";
import { DM_Sans, Fraunces, IBM_Plex_Sans_Arabic } from "next/font/google";
import { getLocale } from "@/lib/i18n";
import "./globals.css";

const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"] });
const plexAr = IBM_Plex_Sans_Arabic({
  variable: "--font-plex-ar",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
});
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Royale",
  description: "Gestion de la pâtisserie",
  appleWebApp: { capable: true, title: "Royale", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#faf6f0",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      dir={locale === "ar" ? "rtl" : "ltr"}
      className={`${dmSans.variable} ${plexAr.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
