"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { FaMoon, FaSun } from "react-icons/fa";

export default function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      className="fixed top-6 right-6 z-50 p-3 rounded-full transition-all duration-500 transform hover:scale-110 shadow-lg hover:shadow-2xl backdrop-blur-sm"
      style={{
        background: isDark
          ? "linear-gradient(135deg, #374151, #1f2937)"
          : "linear-gradient(135deg, #fbbf24, #f59e0b)",
        border: `2px solid ${isDark ? "#6b7280" : "rgba(251, 191, 36, 0.3)"}`,
      }}
      title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
    >
      <div className="relative w-6 h-6 overflow-hidden">
        {/* Sun Icon */}
        <FaSun
          className={`absolute inset-0 w-6 h-6 transition-all duration-500 ${
            isDark
              ? "transform translate-y-8 opacity-0 text-yellow-300"
              : "transform translate-y-0 opacity-100 text-gray-900"
          }`}
        />

        {/* Moon Icon */}
        <FaMoon
          className={`absolute inset-0 w-6 h-6 transition-all duration-500 ${
            isDark
              ? "transform translate-y-0 opacity-100 text-yellow-100"
              : "transform -translate-y-8 opacity-0 text-gray-900"
          }`}
        />
      </div>
    </button>
  );
}
