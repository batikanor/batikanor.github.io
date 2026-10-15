// Keep legacy utility classes on the same palette as the gallery.
const portfolioColor = (token) =>
  `color-mix(in srgb, var(--portfolio-${token}) calc(<alpha-value> * 100%), transparent)`;

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
      fontFamily: {
        sans: ["var(--portfolio-font-body)"],
        display: ["var(--portfolio-font-display)"],
      },
      colors: {
        "light-background": portfolioColor("bg"),
        "light-background-secondary": portfolioColor("surface"),
        "light-foreground": portfolioColor("text"),
        "light-foreground-secondary": portfolioColor("text-secondary"),
        "light-border": portfolioColor("border"),
        "light-navbar": portfolioColor("surface"),
        "light-footer": portfolioColor("surface"),
        "dark-background": portfolioColor("bg"),
        "dark-background-secondary": portfolioColor("surface"),
        "dark-foreground": portfolioColor("text"),
        "dark-foreground-secondary": portfolioColor("text-secondary"),
        "dark-border": portfolioColor("border"),
        "dark-navbar": portfolioColor("surface"),
        "dark-footer": portfolioColor("surface"),
        "light-input": portfolioColor("surface-deep"),
        "dark-input": portfolioColor("surface-deep"),
        accent: portfolioColor("accent"),
        "accent-hover": portfolioColor("accent-hover"),
        "accent-dark": portfolioColor("accent-strong"),
        "accent-darker": portfolioColor("accent"),
        "text-on-accent": portfolioColor("on-accent"),
        "accent-red": "#ef4444",
        "accent-red-hover": "#dc2626",
        "accent-brown": portfolioColor("accent"),
        "accent-brown-hover": portfolioColor("accent-hover"),
        "accent-brown-dark": portfolioColor("surface-deep"),
        white: "#ffffff",
        black: "#000000",
      },
    },
  },
  plugins: [],
};
