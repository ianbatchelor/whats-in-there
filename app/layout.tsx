import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, Bricolage_Grotesque, DM_Mono } from "next/font/google";
import { NativeLinks } from "@/components/NativeLinks";
import "./globals.css";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"], weight: ["500", "700", "800"], variable: "--font-bricolage" });
const atkinson = Atkinson_Hyperlegible({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-atkinson" });
const dmMono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-dm-mono" });

export const metadata: Metadata = {
  title: "What's in There?",
  description: "Know what's in every freezer, fridge and cupboard. Tap, photograph, store.",
  applicationName: "What's in There?",
  appleWebApp: { capable: true, title: "What's in There?", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef4f5" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1a1f" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${bricolage.variable} ${atkinson.variable} ${dmMono.variable}`}>
      <body>
        <NativeLinks />
        {children}
      </body>
    </html>
  );
}
