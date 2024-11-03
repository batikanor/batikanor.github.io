// components/Navbar.js
"use client";

import { useState } from 'react';
import Link from 'next/link';
import {
  Bars3Icon as MenuIcon,
  XMarkIcon as XIcon,
} from '@heroicons/react/24/solid';

export default function Navbar() {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <nav className="bg-gradient-to-r from-gray-900 via-gray-800 to-black text-white fixed top-0 left-0 right-0 z-50 shadow-lg backdrop-blur-sm">
      <div className="container mx-auto flex justify-between items-center py-4 px-6 md:px-12 lg:px-16">
        {/* Logo */}
        <Link href="/">
          <span className="text-2xl md:text-3xl font-bold tracking-wide cursor-pointer hover:text-gray-300 transition duration-200">
            Batıkan Bora Ormancı
          </span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex gap-10 text-lg font-medium">
          <Link href="/">
            <span className="hover:text-gray-300 transition duration-300 cursor-pointer">Home</span>
          </Link>
          <Link href="/cv">
            <span className="hover:text-gray-300 transition duration-300 cursor-pointer">CV</span>
          </Link>
          <Link href="/projects">
            <span className="hover:text-gray-300 transition duration-300 cursor-pointer">Projects</span>
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <div className="md:hidden">
          <button
            onClick={() => setNavOpen(!navOpen)}
            aria-label="Toggle menu"
          >
            {navOpen ? (
              <XIcon className="h-7 w-7 text-gray-300 hover:text-gray-500 transition duration-200" />
            ) : (
              <MenuIcon className="h-7 w-7 text-gray-300 hover:text-gray-500 transition duration-200" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {navOpen && (
        <div className="md:hidden bg-gradient-to-r from-gray-900 via-gray-800 to-black text-white shadow-lg">
          <div className="container mx-auto flex flex-col gap-6 py-6 px-8 text-lg font-medium">
            <Link href="/">
              <span className="hover:text-gray-300 transition duration-300 cursor-pointer">Home</span>
            </Link>
            <Link href="/cv">
              <span className="hover:text-gray-300 transition duration-300 cursor-pointer">CV</span>
            </Link>
            <Link href="/projects">
              <span className="hover:text-gray-300 transition duration-300 cursor-pointer">Projects</span>
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
