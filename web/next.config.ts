import type { NextConfig } from "next";

const config: NextConfig = {
  images: {
    remotePatterns: [
      { hostname: "www.camara.leg.br" },
      { hostname: "www.senado.leg.br" },
      { hostname: "legis.senado.leg.br" },
    ],
  },
};

export default config;
