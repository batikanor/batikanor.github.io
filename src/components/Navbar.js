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
    <nav className="bg-black text-white fixed top-0 left-0 right-0 z-50 shadow-md">
      <div className="container mx-auto flex justify-between items-center py-4 px-6">
        {/* Logo */}
        <Link href="/">
          <span className="text-2xl font-bold cursor-pointer">Batikan Bora Ormanci</span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex gap-8 text-lg">
          <Link href="/">
            <span className="hover:text-gray-400 transition duration-200 cursor-pointer">Home</span>
          </Link>
          <Link href="/blog">
            <span className="hover:text-gray-400 transition duration-200 cursor-pointer">Blog</span>
          </Link>
          <Link href="/about">
            <span className="hover:text-gray-400 transition duration-200 cursor-pointer">About</span>
          </Link>
          <Link href="/cv">
            <span className="hover:text-gray-400 transition duration-200 cursor-pointer">CV</span>
          </Link>
          <Link href="/contact">
            <span className="hover:text-gray-400 transition duration-200 cursor-pointer">Contact</span>
          </Link>
          <Link href="/projects">
            <span className="hover:text-gray-400 transition duration-200 cursor-pointer">Projects</span>
          </Link>
          <Link href="/demo">
            <span className="hover:text-gray-400 transition duration-200 cursor-pointer">Demo</span>
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <div className="md:hidden">
          <button
            onClick={() => setNavOpen(!navOpen)}
            aria-label="Toggle menu"
          >
            {navOpen ? (
              <XIcon className="h-6 w-6 text-white" />
            ) : (
              <MenuIcon className="h-6 w-6 text-white" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {navOpen && (
        <div className="md:hidden bg-black text-white">
          <div className="container mx-auto flex flex-col gap-4 py-4 px-6">
            <Link href="/">
              <span className="hover:text-gray-400 transition duration-200 cursor-pointer">Home</span>
            </Link>
            <Link href="/blog">
              <span className="hover:text-gray-400 transition duration-200 cursor-pointer">Blog</span>
            </Link>
            <Link href="/about">
              <span className="hover:text-gray-400 transition duration-200 cursor-pointer">About</span>
            </Link>
            <Link href="/cv">
              <span className="hover:text-gray-400 transition duration-200 cursor-pointer">CV</span>
            </Link>
            <Link href="/contact">
              <span className="hover:text-gray-400 transition duration-200 cursor-pointer">Contact</span>
            </Link>
            <Link href="/projects">
              <span className="hover:text-gray-400 transition duration-200 cursor-pointer">Projects</span>
            </Link>
            <Link href="/demo">
              <span className="hover:text-gray-400 transition duration-200 cursor-pointer">Demo</span>
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
