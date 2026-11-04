import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { DataProvider } from "@/components/DataProvider";
import { Shell } from "@/components/Shell";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://pydantic.vercel.app"),
  title: { default: "Seconda Mano Hunter × Sander Chill House", template: "%s · Seconda Mano Hunter" },
  description: "Gli affari su Amazon Seconda Mano confrontati col prezzo del nuovo, con un voto da 0 a 100 per ogni offerta.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#e8f0fa",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={jakarta.variable}>
      <body className="antialiased">
        <DataProvider>
          <Shell>{children}</Shell>
        </DataProvider>
      </body>
    </html>
  );
}
