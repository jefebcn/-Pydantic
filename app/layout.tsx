import type { Metadata, Viewport } from "next";
import { DataProvider } from "@/components/DataProvider";
import { Shell } from "@/components/Shell";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Seconda Mano Hunter × Sander Chill House", template: "%s · Seconda Mano Hunter" },
  description: "Gestionale per l'arbitraggio Amazon Seconda Mano: offerte, margini, magazzino e rivendite.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className="antialiased">
        <DataProvider>
          <Shell>{children}</Shell>
        </DataProvider>
      </body>
    </html>
  );
}
