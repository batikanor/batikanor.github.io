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

        "dark-background": "#0a0806", // warm dark obsidian
        "dark-background-secondary": "#160f0a", // rich warm dark brown
        "dark-foreground": "#faf4ed", // warm parchment
        "dark-foreground-secondary": "#d4c5b5", // warm sand/bronze
        "dark-border": "#2d1c12", // warm dark bronze border
        "dark-navbar": "#140d08", // warm dark espresso
        "dark-footer": "#140d08", // warm dark espresso

        "light-input": "rgba(255, 255, 255, 0.8)",
        "dark-input": "rgba(255, 255, 255, 0.05)",

        accent: "#f59e0b", // amber-500
        "accent-hover": "#fbbf24", // amber-400
        "accent-dark": "#d97706", // amber-600
        "accent-darker": "#b45309", // amber-700

        "text-on-accent": "#111827", // gray-900

        "accent-red": "#ef4444", // red-500
        "accent-red-hover": "#dc2626", // red-600
        "accent-brown": "#8a4c1d", // rich warm brown
        "accent-brown-hover": "#a35c24", // warm bronze brown
        "accent-brown-dark": "#5c3317", // deep earth brown

        white: "#ffffff",
        black: "#000000",
      },
    },
  },
  plugins: [],
};
