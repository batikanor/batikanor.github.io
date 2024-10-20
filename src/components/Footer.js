// components/Footer.js

import Link from 'next/link';
import { FaGithub, FaLinkedin, FaEnvelope } from 'react-icons/fa';

export default function Footer() {
  return (    
    <footer className="bg-white dark:bg-gray-800 fixed bottom-3 left-0 right-0 z-50 shadow-inner">
      <div className="container mx-auto px-6 py-4 flex flex-col md:flex-row justify-between items-center">
        <p className="text-gray-600 dark:text-gray-300 text-sm">
          &copy; {new Date().getFullYear()} Batıkan Bora Ormancı. All rights reserved.
        </p>
        <div className="flex space-x-6 mt-2 md:mt-0">
          <Link
            href="https://github.com/batikanor"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-600 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400"
          >
            <FaGithub size={20} />
          </Link>
          <Link
            href="https://linkedin.com/in/batikanor"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-600 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400"
          >
            <FaLinkedin size={20} />
          </Link>
          <Link
            href="mailto:batikanor@gmail.com"
            className="text-gray-600 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400"
          >
            <FaEnvelope size={20} />
          </Link>
        </div>
      </div>
    </footer>
  );
}
