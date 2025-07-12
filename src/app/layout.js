// app/layout.js
import { ThemeProvider } from "next-themes";
import localFont from "next/font/local";
import Footer from "../components/Footer";
import { SuiProviders } from "../components/SuiProviders";
import ThemeToggle from "../components/ThemeToggle";
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

export const metadata = {
  title: "BatikanoR | Portfolio of Batıkan Bora Ormancı",
  description:
    "Portfolio showcasing the projects and work of Batıkan Bora Ormancı.",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body
        className="antialiased flex flex-col min-h-screen"
        suppressHydrationWarning
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <SuiProviders>
            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Main Content Area - Full width, no navbar offset needed */}
            <main className="flex-1 relative">
              <div className="w-full max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-4 sm:py-8 lg:py-12">
                {children}
              </div>
            </main>

            {/* Modern Footer */}
            <Footer />
          </SuiProviders>
        </ThemeProvider>
      </body>
    </html>
  );
}
