import type { NextConfig } from "next";
import path from "path";

const config: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, ".."),
  images: {
    remotePatterns: [
      { hostname: "www.camara.leg.br" },
      { hostname: "www.senado.leg.br" },
      { hostname: "legis.senado.leg.br" },
    ],
  },
};

export default config;
