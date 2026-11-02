import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Seconda Mano Hunter",
  description: "Le offerte Amazon Seconda Mano con il miglior margine rispetto al nuovo.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className="antialiased">{children}</body>
    </html>
  );
}
