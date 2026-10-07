import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { ToastProvider } from "@/components/Toast";
import { TouchActiveFix } from "@/components/TouchActiveFix";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VPA Racha",
  description: "Organização do racha de vôlei: presença, times e avisos do grupo.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/pwa-icon-v2-192.png", sizes: "192x192", type: "image/png" },
      { url: "/pwa-icon-v2-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon-v2.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "VPA Racha",
  },
};

export const viewport: Viewport = {
  themeColor: "#241457",
  colorScheme: "dark",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <TouchActiveFix />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
