import type { Audience } from "./brand-tokens";

/**
 * Cascata da barra lateral: Frente → Subtipo → Formatos (vários).
 * Larguras/alturas em px da peça exportada.
 */
export const MENU_CONFIG = {
  frentes: [
    { id: "ci", label: "Comunicação Interna" },
    { id: "me", label: "Marca Empregadora" },
    { id: "impresso", label: "Material Impresso" },
  ],
  subtipos: {
    ci: [
      { id: "institucional", label: "Institucional Agibank" },
      { id: "jeito_agi_verde", label: "Jeito Agi - Agir como empreendedor" },
      { id: "jeito_agi_amarelo", label: "Jeito Agi - Crescer na jornada" },
      { id: "jeito_agi_azul", label: "Jeito Agi - Viver pelo cliente" },
    ],
    me: [
      { id: "institucional", label: "Institucional" },
      { id: "estagio", label: "Programa de Estágio" },
    ],
    impresso: [
      { id: "interno", label: "Uso Interno" },
      { id: "externo", label: "Uso Externo" },
    ],
  },
  formatos: {
    ci: [
      { id: "alerta", label: "Alerta", width: 600, height: 600 },
      { id: "banner_home", label: "Banner Home", width: 585, height: 300 },
      { id: "card_materia", label: "Card de Matéria", width: 550, height: 490 },
      { id: "cabecalho_psj", label: "Cabeçalho Portal", width: 1900, height: 400 },
      { id: "popup", label: "Popup", width: 900, height: 900 },
    ],
    me: [
      { id: "linkedin_quadrado", label: "LinkedIn Quadrado", width: 1080, height: 1080 },
      { id: "linkedin_vertical", label: "LinkedIn Vertical", width: 1080, height: 1350 },
      { id: "linkedin_horizontal", label: "LinkedIn Horizontal", width: 1200, height: 628 },
    ],
    impresso: [
      { id: "a5", label: "A5 (Vertical)", width: 1748, height: 2480 },
      { id: "a4", label: "A4 (Vertical)", width: 2480, height: 3508 },
    ],
  },
};

export type FrenteId = keyof typeof MENU_CONFIG.formatos;
export type FormatSpec = (typeof MENU_CONFIG.formatos)[FrenteId][number];

/** Contexto de marca da peça, decidido pela cascata. */
export interface PieceContext {
  frente: FrenteId;
  subtipo: string;
  /** logos.audienceRule: CI → interno, Marca Empregadora → externo, Impresso → pelo subtipo. */
  audience: Audience;
  /** logos.usageMap: impresso usa os logos CMYK. */
  midia: "digital" | "impresso";
}

export function pieceContext(frente: FrenteId, subtipo: string): PieceContext {
  const audience: Audience = frente === "ci" ? "interno" : frente === "me" ? "externo" : subtipo === "interno" ? "interno" : "externo";
  return { frente, subtipo, audience, midia: frente === "impresso" ? "impresso" : "digital" };
}

/** Canais de logos.audienceRule.*.exemplos em que cada formato circula (validação de audiência do logo). */
const CHANNELS_BY_FORMAT: Record<string, string[]> = {
  alerta: ["alerta-sj", "alerta-teams"],
  card_materia: ["card-materia"],
  popup: ["popup-psj"],
  linkedin_quadrado: ["linkedin-institucional"],
  linkedin_vertical: ["linkedin-institucional"],
  linkedin_horizontal: ["linkedin-institucional"],
};

export function channelsFor(format: FormatSpec, ctx: PieceContext): string[] {
  if (ctx.frente === "impresso" && ctx.audience === "externo") return ["material-impresso-externo"];
  return CHANNELS_BY_FORMAT[format.id] ?? [];
}
