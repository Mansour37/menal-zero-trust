import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MENAL Zero Trust Dashboard",
  description: "Tableau de bord securite - MENAL SARL",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="bg-gray-50 text-gray-900">{children}</body>
    </html>
  );
}
