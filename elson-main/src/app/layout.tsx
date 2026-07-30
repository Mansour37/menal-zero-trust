import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorkerRegistrar } from "./sw-registrar";
import { I18nProvider } from "@/lib/i18n-context";
import { AntiScraping } from "@/components/AntiScraping";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#10b981",
};

export const metadata: Metadata = {
  title: "Elson | Hassaniya Crowdsourcing | ألسن",
  description:
    "Compétition de traduction et d'enregistrement audio en Hassaniya. Traduisez, enregistrez votre voix et gagnez des prix. مسابقة ترجمة وتسجيل صوتي بالحسانية",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.svg",
    apple: "/icons/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Elson",
  },
  openGraph: {
    title: "Elson | Hassaniya Crowdsourcing",
    description: "Traduisez en Hassaniya, enregistrez votre voix, gagnez 100,000 MRU de prix.",
    type: "website",
    locale: "fr_FR",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        {/* Apply theme before paint to avoid a flash (toggle + system fallback) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Cairo:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="noise-bg">
        <I18nProvider>
          {children}
        </I18nProvider>
        <AntiScraping />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
