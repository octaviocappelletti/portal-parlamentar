import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-raleway)", "system-ui", "sans-serif"],
      },
      colors: {
        // Existing marinho palette (kept for backward compat)
        marinho: {
          50:  "#f0f4fb",
          100: "#dce8f7",
          200: "#b9cfee",
          300: "#87abdf",
          400: "#5081c7",
          500: "#2d5eac",
          600: "#1a4690",
          700: "#0d3170",
          800: "#002776",
          900: "#001b5a",
          950: "#000f35",
        },
        // Capivara design tokens — via CSS custom properties (suporta alto contraste)
        "brand-blue":      "var(--color-brand-blue)",
        "brand-blue-dark": "var(--color-brand-blue-dark)",
        "brand-green":     "var(--color-brand-green)",
        "brand-yellow":    "var(--color-brand-yellow)",
        "danger":          "var(--color-danger)",
        "blue-bg":         "var(--color-blue-bg)",
        "green-bg":        "var(--color-green-bg)",
        "yellow-bg":       "var(--color-yellow-bg)",
        "yellow-text":     "var(--color-yellow-text)",
        "text-strong":     "var(--color-text-strong)",
        "text-body":       "var(--color-text-body)",
        "text-muted":      "var(--color-text-muted)",
        "border-base":     "var(--color-border-base)",
        "border-input":    "var(--color-border-input)",
        "track":           "var(--color-track)",
        "surface-alt":     "var(--color-surface-alt)",
        "page-bg":         "var(--color-page-bg)",
      },
    },
  },
  safelist: [
    { pattern: /^bg-marinho-/ },
    { pattern: /^text-marinho-/ },
    { pattern: /^border-marinho-/ },
    { pattern: /^ring-marinho-/ },
    { pattern: /^hover:bg-marinho-/, variants: ["hover"] },
    { pattern: /^hover:border-marinho-/, variants: ["hover"] },
    { pattern: /^hover:text-marinho-/, variants: ["hover"] },
    { pattern: /^focus-visible:ring-marinho-/, variants: ["focus-visible"] },
    { pattern: /^group-hover:ring-marinho-/, variants: ["group-hover"] },
  ],
  plugins: [],
};

export default config;
