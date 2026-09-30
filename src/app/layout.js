// app/layout.js
import { ThemeProvider } from "next-themes";
import localFont from "next/font/local";
import Footer from "../components/Footer";
import SiteBackground from "../components/SiteBackground";
import { SuiProviders } from "../components/SuiProviders";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

const staging = process.env.EARTH_DEPLOY_TARGET === "staging";

export const metadata = {
  metadataBase: new URL(staging ? "https://staging.batikanor.com" : "https://batikanor.com"),
  title: "Batıkan — Hacker · Developer · Entrepreneur",
  description:
    "Portfolio showcasing the projects and work of Batıkan Bora Ormancı.",
  robots: staging
    ? { index: false, follow: false, googleBot: { index: false, follow: false } }
    : { index: true, follow: true },
  openGraph: {
    type: "website",
    siteName: "Batıkan Bora Ormancı",
    title: "Batıkan — Hacker · Developer · Entrepreneur",
    description: "Portfolio showcasing the projects and work of Batıkan Bora Ormancı.",
    images: [{ url: "/seo/batikan-social.png", width: 1200, height: 630, alt: "Batıkan — Hacker · Developer · Entrepreneur" }],
  },
  twitter: { card: "summary_large_image" },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`dark ${geistSans.variable} ${geistMono.variable}`}
    >
      <body
        className="antialiased flex flex-col min-h-screen relative bg-[#0a0806] text-white selection:bg-amber-400 selection:text-gray-950"
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          forcedTheme="dark"
          defaultTheme="dark"
          enableSystem={false}
        >
          <SuiProviders>
            {/* Full-screen Topographic 3D World Background */}
            <SiteBackground />

            {/* Main Content Area - z-10 over the map, pointer-events-none allows dragging & clicking map through open spaces */}
            <main className="flex-1 relative z-10 pointer-events-none">
              <div className="w-full max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-4 sm:py-8 lg:py-12">
                {children}
              </div>
            </main>

            {/* Modern Footer */}
            <div className="relative z-10 pointer-events-auto">
              <Footer />
            </div>
          </SuiProviders>
        </ThemeProvider>
      </body>
    </html>
  );
}
