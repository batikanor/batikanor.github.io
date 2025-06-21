"use client";

import { FaEnvelope, FaGithub, FaHeart, FaLinkedin } from "react-icons/fa";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-20 py-8 border-t border-gray-200 dark:border-gray-800">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex flex-col items-center space-y-4">
          {/* Social Links */}
          <div className="flex space-x-6">
            <a
              href="https://github.com/batikanor"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-500 transition-colors"
              aria-label="GitHub"
            >
              <FaGithub className="text-2xl" />
            </a>
            <a
              href="https://linkedin.com/in/batikanor"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-500 transition-colors"
              aria-label="LinkedIn"
            >
              <FaLinkedin className="text-2xl" />
            </a>
            <a
              href="mailto:batikanor@gmail.com"
              className="text-gray-600 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-500 transition-colors"
              aria-label="Email"
            >
              <FaEnvelope className="text-2xl" />
            </a>
          </div>

          {/* Copyright */}
          <div className="text-center text-sm text-gray-600 dark:text-gray-400">
            <p className="flex items-center gap-1">
              Made with{" "}
              <FaHeart className="text-amber-600 dark:text-amber-500" /> by
              Batıkan
            </p>
            <p className="mt-1">© {currentYear} All rights reserved</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
