/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class", // Enable class-based dark mode
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "light-background": "#f9fafb", // gray-50
        "light-background-secondary": "#f3f4f6", // gray-100
        "light-foreground": "#111827", // gray-900
        "light-foreground-secondary": "#4b5563", // gray-600
        "light-border": "#e5e7eb", // gray-200
        "light-navbar": "#ffffff", // white
        "light-footer": "#f3f4f6", // gray-100

        "dark-background": "#111827", // gray-900
        "dark-background-secondary": "#1f2937", // gray-800
        "dark-foreground": "#f3f4f6", // gray-100
        "dark-foreground-secondary": "#d1d5db", // gray-300
        "dark-border": "#374151", // gray-700
        "dark-navbar": "#1f2937", // gray-800
        "dark-footer": "#1f2937", // gray-800

        "light-input": "rgba(255, 255, 255, 0.8)",
        "dark-input": "rgba(255, 255, 255, 0.05)",

        accent: "#f59e0b", // amber-500
        "accent-hover": "#fbbf24", // amber-400
        "accent-dark": "#d97706", // amber-600
        "accent-darker": "#b45309", // amber-700

        "text-on-accent": "#111827", // gray-900

        "accent-red": "#ef4444", // red-500
        "accent-red-hover": "#dc2626", // red-600
        "accent-blue": "#3b82f6", // blue-500
        "accent-blue-hover": "#2563eb", // blue-600

        white: "#ffffff",
        black: "#000000",
      },
    },
  },
  plugins: [],
};
