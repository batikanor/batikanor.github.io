import Link from 'next/link';
import { FaGithub, FaLinkedin, FaEnvelope } from 'react-icons/fa';

export default function Footer() {
  return (
    <footer className="bg-[var(--footer-background-light)] dark:bg-[var(--footer-background-dark)] shadow-inner fixed bottom-0 left-0 right-0 z-50">
      <div className="container mx-auto px-6 py-4 flex flex-col md:flex-row justify-between items-center">
        <p className="text-[var(--foreground-light)] dark:text-[var(--foreground-dark)] text-sm">
          &copy; {new Date().getFullYear()} Batıkan Bora Ormancı. All rights reserved.
        </p>
        <div className="flex space-x-6 mt-2 md:mt-0">
          <Link
            href="https://github.com/batikanor"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--foreground-light)] dark:text-[var(--foreground-dark)] hover:text-blue-500 dark:hover:text-blue-400"
          >
            <FaGithub size={20} />
          </Link>
          <Link
            href="https://linkedin.com/in/batikanor"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--foreground-light)] dark:text-[var(--foreground-dark)] hover:text-blue-500 dark:hover:text-blue-400"
          >
            <FaLinkedin size={20} />
          </Link>
          <Link
            href="mailto:batikanor@gmail.com"
            className="text-[var(--foreground-light)] dark:text-[var(--foreground-dark)] hover:text-blue-500 dark:hover:text-blue-400"
          >
            <FaEnvelope size={20} />
          </Link>
        </div>
      </div>
    </footer>
  );
}
