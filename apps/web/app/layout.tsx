import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import LenisProvider from "./components/LenisProvider";

export const metadata: Metadata = {
  title: "KinetiCare — Health Intelligence Platform",
  description: "5-pillar multimodal AI health screening. No wearables required. Mental health, vitals, blood, neuromotor, and LLM synthesis.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "KinetiCare",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#091F18",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
        />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <LenisProvider>
          {children}
        </LenisProvider>
      </body>
    </html>
  );
}
