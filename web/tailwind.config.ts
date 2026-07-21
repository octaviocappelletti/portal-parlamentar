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
        // Capivara design tokens
        "brand-blue":      "#1351B4",
        "brand-blue-dark": "#071d41",
        "brand-green":     "#168821",
        "brand-yellow":    "#FFCD07",
        "danger":          "#c0392b",
        "blue-bg":         "#e8f0fb",
        "green-bg":        "#e7f4ea",
        "yellow-bg":       "#fdf3cd",
        "yellow-text":     "#8a6d00",
        "text-strong":     "#1c2733",
        "text-body":       "#54606e",
        "text-muted":      "#7a8798",
        "border-base":     "#e4e9f0",
        "border-input":    "#d3dae4",
        "track":           "#eef2f7",
        "surface-alt":     "#f4f7fc",
        "page-bg":         "#e9edf3",
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
