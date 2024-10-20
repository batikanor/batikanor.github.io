// src/components/Navbar.js

export default function Navbar() {
    return (
      <nav className="flex flex-col sm:flex-row flex-wrap justify-center gap-4 sm:gap-8 text-lg sm:text-xl py-4">
        <a href="/" className="text-purple-700 font-bold hover:text-purple-500 transition duration-200">Home</a>
        <a href="/blog" className="hover:text-purple-500 transition duration-200">Blog</a>
        <a href="/about" className="hover:text-purple-500 transition duration-200">About</a>
        <a href="/cv" className="hover:text-purple-500 transition duration-200">CV</a>
        <a href="/contact" className="hover:text-purple-500 transition duration-200">Contact</a>
        <a href="/projects" className="hover:text-purple-500 transition duration-200">Projects</a>
        <a href="/demo" className="hover:text-purple-500 transition duration-200">Demo</a>
      </nav>
    );
  }
  