import localFont from "next/font/local";
import "./globals.css"; // Assuming your global styles are here

// Load custom fonts with font-display: swap to ensure text remains visible during font loading
const geistSans = localFont({
  src: "./fonts/GeistVF.woff",  // Corrected path to your font
  variable: "--font-geist-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",  // Corrected path to your font
  variable: "--font-geist-mono",
  weight: "100 900",
});

// Metadata for SEO
export const metadata = {
  title: "BatikanoR | Portfolio of Batıkan Bora Ormancı",
  description: "Portfolio showcasing the projects and work of Batıkan Bora Ormancı.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* Viewport meta tag for responsive design */}
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="description" content="Portfolio website of Batıkan Bora Ormancı" />

        {/* Open Graph meta tags for better social media previews */}
        <meta property="og:title" content="BatikanoR | Portfolio of Batıkan Bora Ormancı" />
        <meta property="og:description" content="Showcasing projects and work of Batıkan Bora Ormancı." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://batikanor.com" />
        <meta property="og:image" content="https://batikanor.com/images/portfolio-cover.jpg" />
      </head>

      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="flex min-h-screen">
          {/* Left side green background (hidden on mobile) */}
          <div className="hidden lg:block bg-green-800 w-1/5"></div>

          {/* Main content section, using default browser colors for light/dark mode */}
          <main className="flex-1 p-6 sm:p-12">
            {children}
          </main>

          {/* Right side gray background (hidden on mobile) */}
          <div className="hidden lg:block bg-gray-700 w-1/5"></div>
        </div>
      </body>
    </html>
  );
}
