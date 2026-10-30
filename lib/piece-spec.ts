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

export type Layer = BackgroundLayer | TextLayer | CtaLayer | ShapesLayer | LogoLayer;

/** Texto da peça (o mesmo em todos os formatos do desdobramento). */
const COPY = {
  headline: "Chega de complicar.",
  corpo: "Organize seus boletos em um só lugar e automatize pagamentos com **Pix**!",
  cta: "Acesse o app do Agi e confira as funções",
};

/**
 * Camadas da peça para um formato. As posições verticais são resolvidas depois, com o texto
 * medido (lib/piece-style.ts → composeLayers); aqui ficam tamanhos, larguras e margens.
 */
export function buildLayers(size: Size, ctx: { audience: Audience; midia: "digital" | "impresso" }): Layer[] {
  const s = formatScale(size);
  const margin = frameMargins(size);
  const wide = isLandscape(size);
  const px = (v: number) => Math.round(v * s);
  return [
    { id: "fundo", label: "Fundo", type: "background", color: "azulAgibank" },
    { id: "grafismo", label: "Grafismo gerado", type: "shapes" },
    {
      id: "headline",
      label: "Headline",
      type: "text",
      role: "titulo",
      text: COPY.headline,
      color: "verde",
      weight: "extraBold",
      fontSize: px(48),
      lineHeight: 1.15,
      x: margin.x,
      y: 0,
      width: Math.round(size.width * (wide ? 0.5 : 0.85)),
    },
    {
      id: "corpo",
      label: "Corpo de texto",
      type: "text",
      role: "corpo",
      text: COPY.corpo,
      color: "branco",
      weight: "regular",
      highlight: { color: "verde", weight: "bold" },
      fontSize: px(22),
      lineHeight: 1.35,
      x: margin.x,
      y: 0,
      // Abaixo do máximo de 85% (400px no 600×600): quebra equilibrada "…um só lugar / e automatize…".
      width: Math.round(size.width * (wide ? 0.5 : 2 / 3)),
    },
    {
      id: "cta",
      label: "CTA",
      type: "cta",
      text: COPY.cta,
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
    },
    {
      id: "logo",
      label: "Logo",
      type: "logo",
      // logos.audienceRule: interno → logo reduzido "Agi"; externo → "Agibank" completo (mais largo).
      audience: ctx.audience,
      midia: ctx.midia,
      marginX: margin.x,
      marginY: margin.y,
      width: px(ctx.audience === "interno" ? 80 : 140),
    },
  ];
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
