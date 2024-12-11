// components/Navbar.js
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Bars3Icon as MenuIcon, XMarkIcon as XIcon } from "@heroicons/react/24/solid";
import { useTheme } from 'next-themes';

export default function Navbar() {
  const [navOpen, setNavOpen] = useState(false);
  const { theme, setTheme, resolvedTheme } = useTheme();

  // This ensures the component only renders on the client-side
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  return (
    <nav className="bg-[var(--navbar-background-light)] dark:bg-[var(--navbar-background-dark)] text-[var(--foreground-light)] dark:text-[var(--foreground-dark)] fixed top-0 left-0 right-0 z-50 shadow-lg backdrop-blur-sm">
      <div className="container mx-auto flex justify-between items-center py-4 px-6 md:px-12 lg:px-16">
        {/* Logo */}
        <Link href="/">
          <span className="text-2xl md:text-3xl font-bold tracking-wide cursor-pointer hover:text-[var(--foreground-dark)] dark:hover:text-[var(--foreground-light)] transition duration-200">
            Batıkan Bora Ormancı
          </span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex gap-10 text-lg font-medium">
          <Link href="/">
            <span className="hover:text-[var(--foreground-dark)] dark:hover:text-[var(--foreground-light)] transition duration-300 cursor-pointer">
              Home
            </span>
          </Link>
          <Link href="/cv">
            <span className="hover:text-[var(--foreground-dark)] dark:hover:text-[var(--foreground-light)] transition duration-300 cursor-pointer">
              CV
            </span>
          </Link>
          <Link href="/projects">
            <span className="hover:text-[var(--foreground-dark)] dark:hover:text-[var(--foreground-light)] transition duration-300 cursor-pointer">
              Projects
            </span>
          </Link>
        </div>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="hidden md:inline-block text-[var(--foreground-light)] dark:text-[var(--foreground-dark)] hover:text-[var(--foreground-dark)] dark:hover:text-[var(--foreground-light)] transition duration-200"
        >
          {resolvedTheme === "light" ? "🌞" : "🌜"}
        </button>

        {/* Mobile Menu Button */}
        <div className="md:hidden flex items-center gap-4">
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="text-[var(--foreground-light)] dark:text-[var(--foreground-dark)] hover:text-[var(--foreground-dark)] dark:hover:text-[var(--foreground-light)] transition duration-200"
          >
            {resolvedTheme === "light" ? "🌞" : "🌜"}
          </button>

          <button
            onClick={() => setNavOpen(!navOpen)}
            aria-label="Toggle menu"
          >
            {navOpen ? (
              <XIcon className="h-7 w-7 text-[var(--foreground-light)] dark:text-[var(--foreground-dark)] hover:text-[var(--foreground-dark)] dark:hover:text-[var(--foreground-light)] transition duration-200" />
            ) : (
              <MenuIcon className="h-7 w-7 text-[var(--foreground-light)] dark:text-[var(--foreground-dark)] hover:text-[var(--foreground-dark)] dark:hover:text-[var(--foreground-light)] transition duration-200" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {navOpen && (
        <div className="md:hidden bg-[var(--navbar-background-light)] dark:bg-[var(--navbar-background-dark)] text-[var(--foreground-light)] dark:text-[var(--foreground-dark)] shadow-lg">
          <div className="container mx-auto flex flex-col gap-6 py-6 px-8 text-lg font-medium">
            <Link href="/">
              <span className="hover:text-[var(--foreground-dark)] dark:hover:text-[var(--foreground-light)] transition duration-300 cursor-pointer">
                Home
              </span>
            </Link>
            <Link href="/cv">
              <span className="hover:text-[var(--foreground-dark)] dark:hover:text-[var(--foreground-light)] transition duration-300 cursor-pointer">
                CV
              </span>
            </Link>
            <Link href="/projects">
              <span className="hover:text-[var(--foreground-dark)] dark:hover:text-[var(--foreground-light)] transition duration-300 cursor-pointer">
                Projects
              </span>
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
