import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "600"],
});

export const metadata: Metadata = {
  title: "MENAL Sentinel",
  description: "Centre de supervision Zero Trust — MENAL SARL",
};

// Applique le theme AVANT l hydratation React pour eviter un flash clair->sombre
// au chargement (le theme par defaut est sombre ; .light n est ajoute que si
// l utilisateur a explicitement choisi le clair via <ThemeToggle/>).
const THEME_INIT_SCRIPT = `
try {
  if (localStorage.getItem("menal-theme") === "light") {
    document.documentElement.classList.add("light");
  }
} catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
