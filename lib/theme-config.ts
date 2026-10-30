import type { ColorKey, ProgramKey } from "./brand-tokens";

/**
 * Temas de template. As cores são CHAVES de config/assets-map.json → colors (fonte única; HEX e CMYK
 * resolvidos por lib/brand-tokens.ts e lib/color-cmyk.ts), nunca valores soltos.
 */

/**
 * Temas por subtipo de Marca Empregadora: o passo "Tema" só aparece para os subtipos listados aqui.
 * `assetsMapKey` aponta para assets-map.json → programs.<chave> (logo do programa); null = sem logo
 * próprio, identidade institucional. Cores, tipografia e shapes seguem o brandbook geral do Agibank.
 */
export interface Tema {
  id: string;
  label: string;
  assetsMapKey: ProgramKey | null;
}

export const temasPorSubtipo: Partial<Record<string, Tema[]>> = {
  eventos: [
    // Futuros eventos entram aqui, desde que existam em assets-map.json → programs.
    { id: "meetup", label: "Meetup", assetsMapKey: "meetup" },
  ],
  programas: [
    // Só o logo (versão sem edição) por enquanto; o resto segue o brandbook do Agibank.
    { id: "estagio", label: "Programa de Estágio", assetsMapKey: "estagio" },
  ],
};

export type ThemeId = string;

export function temaPorId(subtipo: string | null, id: ThemeId | null): Tema | null {
  return (subtipo && temasPorSubtipo[subtipo]?.find((t) => t.id === id)) || null;
}

/** Recorte da foto: um shape geral da marca (assets-map.json → shapes.byType), sem cor própria. */
export interface Mascara {
  id: string;
  arquivo: string;
}

/**
 * Grafismo decorativo: shape geral da marca, sólido ou só contorno (outline), numa cor da paleta.
 * As formas não são de um produto específico; o tema só escolhe quais usar e como.
 */
export interface Grafismo {
  arquivo: string;
  modo: "solido" | "outline";
  cor: ColorKey;
}

/** Card de Evento/Palestrante (carrossel de LinkedIn: capa, N convidados, encerramento). */
export const temaEvento = {
  id: "meetup" as const,
  nome: "Meetup",
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
  // Logo do programa: assets-map.json → programs.meetup (negativo sobre o fundo azul escuro).
  logo: "meetup" as const satisfies ProgramKey,
  grafismos: {
    capa: { arquivo: "quadrilateral-14.svg", modo: "outline", cor: "verde" },
    encerramento: { arquivo: "triangle-06.svg", modo: "solido", cor: "azulAgibank" },
  } satisfies Record<string, Grafismo>,
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


