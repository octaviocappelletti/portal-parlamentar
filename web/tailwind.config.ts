import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Azul marinho — inspired by the flag's navy circle (#002776).
        // Used as the primary civic accent across the entire UI.
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
