import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Shipped with the app (src/app/fonts, SIL Open Font License) rather than fetched from Google Fonts
// while building: a build never fails because of Google's answer, and the desktop app builds offline.
const inter = localFont({ src: "./fonts/inter-latin-wght-normal.woff2", weight: "100 900", style: "normal", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Billspoon", template: "%s · Billspoon" },
  description: "Billspoon — restaurant billing, KOT, kitchen screen, GST and stock software for India",
  appleWebApp: { capable: true, title: "Billspoon", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0E3B2A",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
