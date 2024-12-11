/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', // Enable class-based dark mode
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: "var(--background-light)",
          dark: "var(--background-dark)",
        },
        foreground: {
          DEFAULT: "var(--foreground-light)",
          dark: "var(--foreground-dark)",
        },
      },
    },
  },
  plugins: [],
};
