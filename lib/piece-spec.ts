import type { Audience, ColorKey, EffectKey, FontWeightKey, IconFile } from "./brand-tokens";
import type { Alignment, CtaStyle } from "./composition-tokens";

/**
 * Peça base (Alerta institucional) desdobrada em qualquer formato: `buildLayers(size, …)` escala
 * tipografia, margens, CTA e logo a partir da referência de 600×600.
 *
 * Só referencia CHAVES de config/assets-map.json (cores, pesos, arquivos, efeitos) e nomes de
 * padrões de config/composition-patterns.json; os valores concretos são resolvidos
 * por lib/brand-tokens.ts e lib/composition-tokens.ts.
 */

/** Lado da peça de referência (Alerta 600×600): todas as medidas abaixo são escaladas a partir dela. */
export const REFERENCE_SIZE = 600;

export interface Size {
  width: number;
  height: number;
}

/**
 * Fator de escala do formato em relação ao Alerta 600×600: pela área (média geométrica dos lados),
 * limitado pelo lado menor (banners baixos como 1900×400 não estouram na vertical) e pela largura
 * (formatos verticais mantêm a quebra de linha do 600×600).
 */
export function formatScale({ width, height }: Size): number {
  return Math.min(Math.sqrt(width * height), Math.min(width, height) * 1.25, width) / REFERENCE_SIZE;
}

/** Formato "deitado" (banners): a coluna de texto ocupa só a metade esquerda e os shapes, o resto. */
export const isLandscape = ({ width, height }: Size) => width / height >= 1.4;

/** Margens da peça: laterais (texto, logo, CTA) e inferior (logo). */
export function frameMargins(size: Size) {
  const s = formatScale(size);
  return { x: Math.round(Math.max(32 * s, size.width * 0.05)), y: Math.round(32 * s) };
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface BaseLayer {
  id: string;
  label: string;
}

export interface BackgroundLayer extends BaseLayer {
  type: "background";
  color: ColorKey;
}

/** Papel tipográfico — chaves de composition-patterns.json → typographyScale. */
export type TextRole = "titulo" | "corpo";

export interface TextStyle {
  color: ColorKey;
  weight: FontWeightKey;
}

export interface TextLayer extends BaseLayer, TextStyle {
  type: "text";
  role: TextRole;
  /** Trechos entre **asteriscos** usam `highlight` (padrão "palavra-chave-destacada"). */
  text: string;
  highlight?: TextStyle;
  fontSize: number;
  lineHeight: number;
  x: number;
  y: number;
  /** Largura máxima; quebra automática por palavra. */
  width: number;
  /** Alinhamento das linhas dentro da caixa (textAndLayoutRules.alignments). */
  align?: Alignment;
}

export interface CtaLayer extends BaseLayer, TextStyle {
  type: "cta";
  text: string;
  fontSize: number;
  lineHeight: number;
  x: number;
  y: number;
  /** "center" centraliza o CTA no canvas (x é ignorado). */
  align?: Alignment;
  /** Variante de composition-patterns.json → ctaRules.variants. */
  variant: CtaStyle;
  /**
   * Caixa da pílula: `fill` sólido e/ou `stroke` (outline). Ausente = sem caixa ("text-only-arrow").
   */
  pill?: {
    fill?: ColorKey;
    stroke?: ColorKey;
    strokeWidth?: number;
    paddingX: number;
    paddingY: number;
    shadow?: EffectKey;
  };
  /** Ícone recolorido com a cor do texto (ctaRules.iconSupport). */
  trailingIcon?: { file: IconFile; size: number; gap: number };
}

export interface Point {
  x: number;
  y: number;
}

/**
 * Lugar dos grafismos na pilha de camadas. Os shapes em si vêm do motor de geração
 * (lib/layout-engine.ts → generateRandomLayout) e mudam a cada "Gerar desdobramento".
 */
export interface ShapesLayer extends BaseLayer {
  type: "shapes";
}

export interface LogoLayer extends BaseLayer {
  type: "logo";
  /** Define a família do logo via logos.audienceRule (interno → Agi, externo → Agibank). */
  audience: Audience;
  midia: "digital" | "impresso";
  /** Distância da borda esquerda (alinhado à esquerda) e da borda inferior. */
  marginX: number;
  marginY: number;
  width: number;
  /** "center" põe o logo no centro inferior. */
  align?: Alignment;
}

/**
 * Imagem enviada pelo usuário, recortada por um polígono irregular grande (arquétipo "máscara").
 * Ocupa uma metade da peça (`region`); os textos vão para a outra metade.
 */
export interface ImageLayer extends BaseLayer {
  type: "image";
  /** Data URL da imagem enviada. */
  src: string;
  placement: ImagePlacement;
  /** Metade da peça reservada para a imagem (os shapes e os textos ficam fora dela). */
  region: Rect;
}

export type ImagePlacement = "right" | "top";

export type Layer = BackgroundLayer | TextLayer | CtaLayer | ShapesLayer | LogoLayer | ImageLayer;

/** Conteúdo da peça (o mesmo em todos os formatos do desdobramento). */
export interface PieceContent {
  headline: string;
  body: string;
  /** Trecho do texto de apoio destacado em verde (padrão "palavra-chave-destacada"). */
  highlight: string;
  cta: string;
}

/** Marca com **…** cada ocorrência do destaque no texto (sem diferenciar maiúsculas). */
export function markHighlight(body: string, highlight: string): string {
  const clean = body.replace(/\*\*/g, "");
  const word = highlight.replace(/\*\*/g, "").trim();
  if (!word) return clean;
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return clean.replace(new RegExp(escaped, "gi"), (m) => `**${m}**`);
}

/** Paisagem e quadrado: imagem na metade direita; retrato: na metade de cima. */
export function imagePlacement({ width, height }: Size): ImagePlacement {
  return width >= height * 0.9 ? "right" : "top";
}

export function imageRegion(size: Size, placement: ImagePlacement): Rect {
  return placement === "right"
    ? { x: Math.round(size.width / 2), y: 0, width: size.width - Math.round(size.width / 2), height: size.height }
    : { x: 0, y: 0, width: size.width, height: Math.round(size.height / 2) };
}

/**
 * Cores de cada lado. Frente: fundo azul Agibank (contrastMap.azulAgibank, verde só em título e
 * palavra-chave). Verso: layout limpo em fundo branco (contrastMap.branco: azuis escuros).
 */
const SIDE_STYLE = {
  frente: {
    background: "azulAgibank",
    headline: "verde",
    body: "branco",
    highlight: "verde",
  },
  verso: {
    background: "branco",
    headline: "azulMedio",
    body: "azulEscuro",
    highlight: "azulMedio",
  },
} as const;

export interface BuildOptions {
  audience: Audience;
  midia: "digital" | "impresso";
  content: PieceContent;
  side?: "frente" | "verso";
  /** Data URL da imagem enviada (só na frente). */
  image?: string | null;
}

/**
 * Camadas da peça para um formato. As posições verticais são resolvidas depois, com o texto
 * medido (lib/piece-style.ts → composeLayers); aqui ficam tamanhos, larguras e margens.
 * Campos de texto vazios não geram camada.
 */
export function buildLayers(size: Size, opts: BuildOptions): Layer[] {
  const s = formatScale(size);
  const margin = frameMargins(size);
  const wide = isLandscape(size);
  const px = (v: number) => Math.round(v * s);
  const side = opts.side ?? "frente";
  const colors = SIDE_STYLE[side];
  const placement = opts.image && side === "frente" ? imagePlacement(size) : null;
  // Com imagem à direita, a coluna de texto fica na metade esquerda.
  const column = placement === "right" ? size.width / 2 - margin.x - px(24) : Infinity;
  const { content } = opts;

  const layers: Layer[] = [
    { id: "fundo", label: "Fundo", type: "background", color: colors.background },
  ];
  if (placement) {
    layers.push({ id: "imagem", label: "Imagem", type: "image", src: opts.image!, placement, region: imageRegion(size, placement) });
  }
  layers.push({ id: "grafismo", label: "Grafismo gerado", type: "shapes" });
  if (content.headline.trim()) {
    layers.push({
      id: "headline",
      label: "Headline",
      type: "text",
      role: "titulo",
      text: content.headline.replace(/\*\*/g, ""),
      color: colors.headline,
      weight: "extraBold",
      fontSize: px(48),
      lineHeight: 1.15,
      x: margin.x,
      y: 0,
      width: Math.round(Math.min(column, size.width * (wide ? 0.5 : 0.85))),
    });
  }
  if (content.body.trim()) {
    layers.push({
      id: "corpo",
      label: "Corpo de texto",
      type: "text",
      role: "corpo",
      text: markHighlight(content.body, content.highlight),
      color: colors.body,
      weight: "regular",
      highlight: { color: colors.highlight, weight: "bold" },
      fontSize: px(22),
      lineHeight: 1.35,
      x: margin.x,
      y: 0,
      // Abaixo do máximo de 85% (400px no 600×600): quebra equilibrada "…um só lugar / e automatize…".
      width: Math.round(Math.min(column, size.width * (wide ? 0.5 : 2 / 3))),
    });
  }
  if (content.cta.trim()) {
    layers.push({
      id: "cta",
      label: "CTA",
      type: "cta",
      text: content.cta,
      color: "azulEscuro",
      weight: "semiBold",
      fontSize: px(18),
      lineHeight: 1.2,
      x: margin.x,
      y: 0,
      // Variante padrão "pill-solid-accent"; o motor de layout troca a cada composição (lib/piece-style.ts).
      variant: "pill-solid-accent",
      pill: { fill: "verde", paddingX: px(28), paddingY: px(18), shadow: "shadowSubtle" },
      trailingIcon: { file: "chevron-right.svg", size: px(18), gap: px(10) },
    });
  }
  layers.push({
    id: "logo",
    label: "Logo",
    type: "logo",
    // logos.audienceRule: interno → logo reduzido "Agi"; externo → "Agibank" completo (mais largo).
    audience: opts.audience,
    midia: opts.midia,
    marginX: margin.x,
    marginY: margin.y,
    width: px(opts.audience === "interno" ? 80 : 140),
  });
  return layers;
}

export function getImage(layers: Layer[]): ImageLayer | undefined {
  return layers.find((l): l is ImageLayer => l.type === "image");
}

/** Posição do logo (canto inferior esquerdo, ou centro inferior quando centralizado). */
export function logoPosition(layer: LogoLayer, size: Size, logoHeight: number) {
  return {
    x: layer.align === "center" ? (size.width - layer.width) / 2 : layer.marginX,
    y: size.height - layer.marginY - logoHeight,
  };
}

export function getBackground(layers: Layer[]): BackgroundLayer | undefined {
  return layers.find((l): l is BackgroundLayer => l.type === "background");
}

export function getLogo(layers: Layer[]): LogoLayer | undefined {
  return layers.find((l): l is LogoLayer => l.type === "logo");
}
