import type { ColorKey } from "./brand-tokens";

/**
 * Temas de template. As cores são CHAVES de config/assets-map.json → colors (fonte única; HEX e CMYK
 * resolvidos por lib/brand-tokens.ts e lib/color-cmyk.ts), nunca valores soltos.
 */

export type ThemeId = "institucional" | "evento";

export interface Mascara {
  id: string;
  /** Polígono irregular normalizado (0–1) na caixa da foto; valores fora de 0–1 sangram. */
  pontos: [number, number][];
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
  // Recorte da foto de cada convidado (round-robin): formas geométricas irregulares.
  mascaras: [
    { id: "diamante_capa", pontos: [[0.52, -0.02], [1.04, 0.44], [0.6, 1.0], [0.0, 0.56]] },
    { id: "trapezio_dir", pontos: [[0.24, -0.04], [1.04, -0.04], [1.04, 1.0], [0.0, 0.88]] },
    { id: "hexagono_irregular", pontos: [[0.3, -0.04], [0.9, 0.02], [1.04, 0.5], [0.82, 1.0], [0.18, 0.94], [0.0, 0.4]] },
    { id: "triangulo_topo", pontos: [[-0.04, -0.04], [1.04, -0.04], [1.04, 0.42], [0.42, 1.0]] },
  ] satisfies Mascara[],
};

export const TEMAS = [temaInstitucional, temaEvento];
