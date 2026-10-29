import type { Config } from "tailwindcss";
import assetsMap from "./config/assets-map.json";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: { brand: assetsMap.colors },
      fontFamily: { brand: [assetsMap.typography.fontFamily, assetsMap.typography.fallback] },
    },
  },
  plugins: [],
};

export default config;
