import type { ColorKey } from "./brand-tokens";

/**
 * Temas de template. As cores são CHAVES de config/assets-map.json → colors (fonte única; HEX e CMYK
 * resolvidos por lib/brand-tokens.ts e lib/color-cmyk.ts), nunca valores soltos.
 */

export type ThemeId = "institucional" | "evento";

export interface Mascara {
  id: string;
  /** Forma real da marca (config/assets-map.json → shapes.byType) usada como recorte da foto. */
  arquivo: string;
}

export const temaInstitucional = {
  id: "institucional" as const,
  nome: "Institucional",
};

/** Card de Evento/Palestrante (carrossel de LinkedIn: capa, N convidados, encerramento). */
export const temaEvento = {
  id: "evento" as const,
  nome: "Meetup / Evento",
  cores: {
    // "Navy" do brandbook = azulEscuro (#000F44) da paleta.
    fundo: "azulEscuro",
    destaque: "verde",
    // A paleta não tem um "azul claro" separado: o azul mais claro é o azulAgibank (#0064F5).
    tarjaSecundaria: "azulAgibank",
    texto: "branco",
    // Texto sobre a tarja verde (contrastMap.verde → azulEscuro).
    textoSobreDestaque: "azulEscuro",
  } satisfies Record<string, ColorKey>,
  // Família do logo institucional (logos.audienceRule.interno → "agi"), desenhado pelo LogoSmart.
  logo: "agi" as const,
  // Recorte da foto de cada convidado (round-robin): formas versionadas em assets/shapes/, nunca
  // polígonos inventados. A foto preenche 100% da forma; a forma não tem cor própria.
  mascaras: [
    { id: "losango", arquivo: "quadrilateral-14.svg" },
    { id: "trapezio", arquivo: "quadrilateral-06.svg" },
    // O repositório não tem hexágono: o polígono irregular de mais lados é o pentágono.
    { id: "poligono_irregular", arquivo: "pentagon-06.svg" },
    { id: "triangulo", arquivo: "triangle-06.svg" },
  ] satisfies Mascara[],
};

export const TEMAS = [temaInstitucional, temaEvento];
