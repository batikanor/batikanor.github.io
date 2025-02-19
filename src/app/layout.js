// app/layout.js
import localFont from 'next/font/local';
import './globals.css';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { ThemeProvider } from 'next-themes';

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
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="antialiased flex flex-col min-h-screen" suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {/* Header */}
          <header className="bg-[var(--navbar-background-light)] dark:bg-[var(--navbar-background-dark)] shadow fixed top-0 left-0 right-0 z-50">
            <Navbar />
          </header>
          <div className="flex-1 flex flex-col lg:flex-row mt-16">
            
            {/* Left Sidebar */}
            <aside className="hidden lg:block lg:w-1/6 p-4 bg-[var(--sidepanel-background-light)] dark:bg-[var(--sidepanel-background-dark)] relative">
              <div
                className="absolute inset-0 bg-center opacity-60 dark:opacity-60"
                style={{ 
                  backgroundImage: "url('/aside-pattern.png')",
                  backgroundSize: "15vw",
                  backgroundPosition: "center"
                }}
              />
              {/* Add content here */}
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-6 sm:p-12 bg-[var(--mainpanel-background-light)] dark:bg-[var(--mainpanel-background-dark)]">
              {children}
            </main>

            {/* Right Sidebar */}
            <aside className="hidden lg:block lg:w-1/6 p-4 bg-[var(--sidepanel-background-light)] dark:bg-[var(--sidepanel-background-dark)] relative">
              <div
                className="absolute inset-0 bg-center opacity-60 dark:opacity-60"
                style={{ 
                  backgroundImage: "url('/aside-pattern.png')",
                  backgroundSize: "15vw",
                  backgroundPosition: "center"
                }}
              />
              {/* Add content here */}
            </aside>

          </div>

          {/* Footer */}
          <footer className="bg-[var(--footer-background-light)] dark:bg-[var(--footer-background-dark)] shadow">
            <Footer />
          </footer>
          <br/>
        </ThemeProvider>
      </body>
    </html>
  );
}
