"use client";

import { FaEnvelope, FaGithub, FaHeart, FaLinkedin } from "react-icons/fa";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="portfolio-footer mt-12 py-7">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex flex-col items-center space-y-4">
          {/* Social Links */}
          <div className="flex space-x-6">
            <a
              href="https://github.com/batikanor"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors"
              aria-label="GitHub"
            >
              <FaGithub className="text-xl" />
            </a>
            <a
              href="https://linkedin.com/in/batikanor"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors"
              aria-label="LinkedIn"
            >
              <FaLinkedin className="text-xl" />
            </a>
            <a
              href="mailto:batikanor@gmail.com"
              className="transition-colors"
              aria-label="Email"
            >
              <FaEnvelope className="text-xl" />
            </a>
          </div>

          {/* Copyright */}
          <div className="text-center text-xs">
            <p className="flex items-center gap-1">
              Made with{" "}
              <FaHeart className="footer-heart" /> by
              Batıkan
            </p>
            <p className="mt-1">© {currentYear} All rights reserved</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
