import localFont from 'next/font/local';
import './globals.css';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

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
      <body className="antialiased flex flex-col min-h-screen">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 shadow">
          <Navbar />
        </header>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col lg:flex-row">
          {/* Left Sidebar */}
          <aside className="hidden lg:block lg:w-1/5 bg-gray-100 dark:bg-gray-900 p-4">
            {/* Add content here */}
          </aside>

          {/* Main Content */}
          <main className="flex-1 p-6 sm:p-12 bg-white dark:bg-gray-800">
            {children}
          </main>

          {/* Right Sidebar */}
          <aside className="hidden lg:block lg:w-1/5 bg-gray-100 dark:bg-gray-900 p-4">
            {/* Add content here */}
          </aside>
        </div>

        {/* Footer */}
        <footer className="bg-white dark:bg-gray-800 shadow">
          <Footer />
        </footer>
        <br/>

      </body>
    </html>
  );
}
