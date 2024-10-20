import localFont from "next/font/local";
import "./globals.css";
import Navbar from "../components/Navbar"; // Import the Navbar component

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
  description: "Portfolio showcasing the projects and work of Batıkan Bora Ormancı.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="description" content="Portfolio website of Batıkan Bora Ormancı" />
      </head>

      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* Navbar is now included here */}
        <Navbar />

        <div className="relative flex min-h-screen">
          {/* Left side green background (hidden on mobile) */}
          <div className="hidden lg:block bg-green-800 w-1/5"></div>

          {/* Main content section with rounded corners, shadow, and higher z-index */}
          <main className="flex-1 p-8 sm:p-16 bg-gray-50 dark:bg-gray-800 rounded-lg shadow-2xl z-10 relative lg:-mx-8">
            {children}
          </main>

          {/* Right side gray background (hidden on mobile) */}
          <div className="hidden lg:block bg-gray-700 w-1/5"></div>
        </div>
      </body>
    </html>
  );
}
