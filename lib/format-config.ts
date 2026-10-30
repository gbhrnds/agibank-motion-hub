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
      { id: "alerta_sj", label: "Alerta SJ", width: 600, height: 600 },
      { id: "alerta_teams", label: "Alerta Teams", width: 600, height: 600 },
      { id: "banner_home", label: "Banner Home", width: 585, height: 300 },
      { id: "miniatura", label: "Miniatura", width: 600, height: 370 },
      { id: "cabecalho_psj", label: "Cabeçalho PSJ", width: 1900, height: 400 },
      { id: "card_materia", label: "Card interno de matéria", width: 550, height: 490 },
      { id: "popup", label: "Popup", width: 900, height: 900 },
      { id: "matinal_sj", label: "Matinal Sempre Juntos", width: 1080, height: 1080 },
      // Agi Campus (telão 1920×1080 e tela 1080×1920) removido por ora (Patch 13).
      { id: "email_header", label: "Cabeçalho de e-mail", width: 1920, height: 350 },
      { id: "email_footer", label: "Rodapé de e-mail", width: 1920, height: 350 },
      { id: "news_footer", label: "Rodapé News", width: 1750, height: 500 },
    ],
    me: [
      { id: "linkedin_quadrado", label: "LinkedIn Quadrado", width: 1080, height: 1080 },
      { id: "linkedin_vertical", label: "LinkedIn Vertical", width: 1080, height: 1350 },
      { id: "linkedin_horizontal", label: "LinkedIn Horizontal", width: 1200, height: 628 },
      { id: "linkedin_carrossel", label: "LinkedIn Carrossel (Base)", width: 1080, height: 1080 },
      { id: "linkedin_banner_empresa", label: "Banner Empresa", width: 1128, height: 376 },
      { id: "linkedin_banner_pessoal", label: "Banner Pessoal", width: 1584, height: 396 },
    ],
    impresso: [
      { id: "a5", label: "A5 (Vertical)", width: 1748, height: 2480 },
      { id: "a4", label: "A4 (Vertical)", width: 2480, height: 3508 },
      { id: "a3", label: "A3 (Vertical)", width: 3508, height: 4960 },
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
  /** logos.usageMap: Material Impresso usa OBRIGATORIAMENTE os logos CMYK (interno ou externo). */
  midia: "digital" | "impresso";
}

export function pieceContext(frente: FrenteId, subtipo: string): PieceContext {
  const audience: Audience = frente === "ci" ? "interno" : frente === "me" ? "externo" : subtipo === "interno" ? "interno" : "externo";
  return { frente, subtipo, audience, midia: frente === "impresso" ? "impresso" : "digital" };
}

/** Canais de logos.audienceRule.*.exemplos em que cada formato circula (validação de audiência do logo). */
const CHANNELS_BY_FORMAT: Record<string, string[]> = {
  alerta_sj: ["alerta-sj"],
  alerta_teams: ["alerta-teams"],
  card_materia: ["card-materia"],
  popup: ["popup-psj"],
  matinal_sj: ["matinal-sj"],
  linkedin_quadrado: ["linkedin-institucional"],
  linkedin_vertical: ["linkedin-institucional"],
  linkedin_horizontal: ["linkedin-institucional"],
  linkedin_carrossel: ["linkedin-institucional"],
  linkedin_banner_empresa: ["linkedin-institucional"],
  linkedin_banner_pessoal: ["linkedin-institucional"],
};

export function channelsFor(format: FormatSpec, ctx: PieceContext): string[] {
  if (ctx.frente === "impresso" && ctx.audience === "externo") return ["material-impresso-externo"];
  return CHANNELS_BY_FORMAT[format.id] ?? [];
}

/** Lado da peça impressa ("Gerar Frente e Verso"); peças digitais são sempre "frente". */
export type Side = "frente" | "verso";

/** Conteúdo editável na barra lateral. `highlight` é marcado em verde dentro do texto de apoio. */
export interface PieceTexts {
  headline: string;
  body: string;
  highlight: string;
  cta: string;
}

export const DEFAULT_TEXTS: PieceTexts = {
  headline: "Chega de complicar.",
  body: "Organize seus boletos em um só lugar e automatize pagamentos com Pix!",
  highlight: "Pix",
  cta: "Acesse o app do Agi e confira as funções",
};
