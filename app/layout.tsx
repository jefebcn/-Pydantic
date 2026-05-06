import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Sidebar from "@/components/Sidebar";
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
  title: "Amazon Infographic Generator",
  description: "Genera 7 slide infografiche professionali da un ASIN Amazon in meno di 90 secondi.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="it"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex" style={{ background: "var(--bg-base)" }}>
        <Sidebar />
        <div className="flex-1 min-h-screen overflow-y-auto">
          {children}
        </div>
      </body>
    </html>
  );
}
