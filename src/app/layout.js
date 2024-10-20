import localFont from 'next/font/local';
import './globals.css';
import Navbar from '../components/Navbar';
// import Footer from '../components/Footer'; // Uncomment if you have a Footer component

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
});

const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  weight: '100 900',
});

export const metadata = {
  title: 'BatikanoR | Portfolio of Batıkan Bora Ormancı',
  description: 'Portfolio showcasing the projects and work of Batıkan Bora Ormancı.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="antialiased">
        {/* Header */}
        <header>
          <Navbar />
        </header>

        {/* Main Content Area */}
        <div className="min-h-screen grid grid-cols-1 lg:grid-cols-5">
          {/* Left Sidebar */}
          <aside className="hidden lg:block bg-green-800 lg:col-span-1"></aside>

          {/* Main Content */}
          <main className="lg:col-span-3 p-6 sm:p-12 bg-gray-50 dark:bg-gray-900">
            {children}
          </main>

          {/* Right Sidebar */}
          <aside className="hidden lg:block bg-gray-700 lg:col-span-1"></aside>
        </div>

        {/* Footer */}
        {/* <Footer /> */}
      </body>
    </html>
  );
}
