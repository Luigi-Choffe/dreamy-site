import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { ConsentBanner } from "@/components/analytics/ConsentBanner";
import { CtaClickDelegate } from "@/components/analytics/CtaClickDelegate";
import { GoogleTagManager, GoogleTagManagerNoScript } from "@/components/analytics/GoogleTagManager";
import { RouteChangeTracker } from "@/components/analytics/RouteChangeTracker";
import { ChromeGate } from "@/components/layout/ChromeGate";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { SkipLink } from "@/components/layout/SkipLink";
import { ToastProvider } from "@/components/ui/Toast";
import { SITE_URL } from "@/config/env";
import { siteConfig } from "@/config/site";
import { robotsFor } from "@/lib/seo/metadata";
import { fontClassNames } from "@/styles/fonts";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Dreamy | Software sob medida e Agentes de IA",
    template: "%s | Dreamy",
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  robots: robotsFor(),
  alternates: { canonical: `${SITE_URL}/` },
  openGraph: {
    type: "website",
    siteName: siteConfig.name,
    locale: "pt_BR",
    url: `${SITE_URL}/`,
    title: "Dreamy | Software sob medida e Agentes de IA",
    description: siteConfig.description,
  },
  twitter: {
    card: "summary_large_image",
    title: "Dreamy | Software sob medida e Agentes de IA",
    description: siteConfig.description,
  },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f8f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0c" },
  ],
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={`${fontClassNames} h-full`}>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <GoogleTagManagerNoScript />
        <SkipLink />
        <ToastProvider>
          <ChromeGate>
            <Header />
          </ChromeGate>
          <main id="conteudo" tabIndex={-1} className="flex-1 outline-none">
            {children}
          </main>
          <ChromeGate>
            <Footer />
            <ConsentBanner />
          </ChromeGate>
          <RouteChangeTracker />
          <CtaClickDelegate />
        </ToastProvider>
        <GoogleTagManager />
      </body>
    </html>
  );
}
