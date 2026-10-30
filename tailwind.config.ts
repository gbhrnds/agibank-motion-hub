import type { Config } from "tailwindcss";
import assetsMap from "./config/assets-map.json";

const { colors, uiColors, typography } = assetsMap;

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Cores lidas de config/assets-map.json (nenhum hex é repetido aqui).
      colors: {
        brand: colors,
        "agi-blue": colors.azulAgibank,
        "agi-blue-mid": colors.azulMedio,
        "agi-blue-dark": colors.azulEscuro,
        "agi-green": colors.verde,
        "agi-green-light": colors.verdeClaro,
        "agi-yellow": colors.amarelo,
        "agi-gray-bg": uiColors.grayBg,
        "agi-gray-border": uiColors.grayBorder,
      },
      fontFamily: {
        sans: [`"${typography.fontFamily}"`, typography.fallback, "sans-serif"],
        brand: [typography.fontFamily, typography.fallback],
      },
    },
  },
  plugins: [],
};

export default config;
