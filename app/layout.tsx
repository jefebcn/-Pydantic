import type { Metadata, Viewport } from "next";
import { Space_Grotesk, DM_Sans, DM_Mono } from "next/font/google";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import Footer from "@/components/Footer";
import CookieBanner from "@/components/CookieBanner";
import { AuthProvider } from "@/lib/auth-context";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const dmMono = DM_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

export const metadata: Metadata = {
  title: {
    default:  "PYDANTIC — Amazon Infographics AI",
    template: "%s · PYDANTIC",
  },
  description: "PYDANTIC: genera 10 infografiche professionali per il tuo listing Amazon partendo da un ASIN — analisi vision, prompts e rendering AI in un unico flusso.",
  applicationName: "PYDANTIC",
  appleWebApp: {
    capable: true,
    title: "PYDANTIC",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
    address: false,
    email: false,
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon-32.png", type: "image/png", sizes: "32x32"   },
      { url: "/logo-192.png",   type: "image/png", sizes: "192x192" },
      { url: "/logo.png",       type: "image/png", sizes: "512x512" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180" },
    ],
    shortcut: "/favicon-32.png",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

/**
 * Viewport is locked to make the site behave like an installed app:
 *   - initialScale 1 + maximumScale 1 + userScalable false → no pinch zoom
 *   - viewportFit cover → respect safe areas (iOS notch / Android nav bar)
 *   - themeColor matches the dark background so the OS status bar blends in
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  minimumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#FAF3F3",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="it"
      className={`${spaceGrotesk.variable} ${dmSans.variable} ${dmMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex no-zoom" style={{ background: "var(--bg-base)" }}>
        <AuthProvider>
          <Sidebar />
          <div className="flex-1 min-h-screen overflow-y-auto flex flex-col">
            <TopBar />
            <div className="flex-1">
              {children}
            </div>
            <Footer />
          </div>
          <CookieBanner />
        </AuthProvider>
      </body>
    </html>
  );
}
