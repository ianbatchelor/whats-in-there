import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, Plus_Jakarta_Sans } from "next/font/google";
import { NativeLinks } from "@/components/NativeLinks";
import { NativePush } from "@/components/notify/NativePush";
import { APP_STORE_ID, appStoreUrl } from "@/lib/config";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-jakarta" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const fraunces = Fraunces({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-fraunces" });

export const metadata: Metadata = {
  title: "See What's in Here",
  description: "Keep track of everything you have, wherever you store it: freezers, cupboards, attics, wardrobes, gardens and more.",
  applicationName: "See What's in Here",
  appleWebApp: { capable: true, title: "See What's in Here", statusBarStyle: "default" },
  // Safari's Smart App Banner ("Open" / "Get" at the top of the page), once the app is on the App Store.
  ...(appStoreUrl() ? { itunes: { appId: APP_STORE_ID } } : {}),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f3eb" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1814" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${jakarta.variable} ${inter.variable} ${fraunces.variable}`}>
      <body>
        <NativeLinks />
        <NativePush />
        {children}
      </body>
    </html>
  );
}
