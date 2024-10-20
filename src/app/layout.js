import localFont from "next/font/local";
import "./globals.css"; // assuming your global styles are here

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

export const metadata = {
  title: "BatikanoR",
  description: "Portfolio website of Batıkan Bora Ormancı",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="flex min-h-screen">
          {/* Left side green background */}
          <div className="bg-green-800 w-1/5"></div>
          {/* Center section uses default browser color (no bg color) */}
          <div className="flex-1 p-6 sm:p-12">
            {children}
          </div>
          {/* Right side gray background */}
          <div className="bg-gray-700 w-1/5"></div>
        </div>
      </body>
    </html>
  );
}
