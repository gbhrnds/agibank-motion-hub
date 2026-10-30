import type { Audience, ColorKey, EffectKey, FontWeightKey, IconFile, ShapeFile } from "./brand-tokens";
import type { ColorMode } from "./svg-utils";

/**
 * Peça fixa do MVP: Alerta institucional de Comunicação Interna 600x600
 * (canais "Alerta Sempre Juntos" e "Alerta Teams").
 *
 * Só referencia CHAVES de config/assets-map.json (cores, pesos, arquivos, efeitos) e nomes de
 * padrões de config/composition-patterns.json; os valores concretos são resolvidos
 * por lib/brand-tokens.ts e lib/composition-tokens.ts.
 */

export const CANVAS_SIZE = 600;
/** Canais onde a peça circula (chaves de logos.audienceRule.*.exemplos). */
export const ALERTA_CHANNELS = ["alerta-sj", "alerta-teams"];
export const EXPORT_FILE_NAME = "agibank-alerta-institucional.png";

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
}

export interface CtaLayer extends BaseLayer, TextStyle {
  type: "cta";
  text: string;
  fontSize: number;
  lineHeight: number;
  x: number;
  y: number;
  /** Caixa sólida atrás do texto (composition-patterns.json → ctaRules). Ausente = texto solto. */
  pill?: { color: ColorKey; paddingX: number; paddingY: number; shadow?: EffectKey };
  /** Ícone recolorido com a cor do texto (ctaRules.iconSupport). */
  trailingIcon?: { file: IconFile; size: number; gap: number };
}

export interface ClusterShape {
  file: ShapeFile;
  color: ColorKey;
  mode: ColorMode;
  /** Maior dimensão desenhada, em px (escala uniforme — nunca distorce proporções). */
  size: number;
  rotation?: number;
  mirror?: boolean;
  /**
   * Centro fixo em px da peça (pode ficar fora do frame para sangrar), ou encaixe no shape
   * `adjacentTo`: desliza na direção `angle` (graus; 0 = direita, 90 = baixo) até encostar,
   * a `gapPercent`% do maior shape de distância (shapeClusterPattern.transformRules.gapRule).
   */
  placement: Point | { adjacentTo: number; angle: number; gapPercent: number };
}

export interface Point {
  x: number;
  y: number;
}

/** Zona do cluster — composition-patterns.json → shapeClusterPattern.positioning[].zone. */
export type ClusterZone = "canto-superior-direito-sangrando" | "ancorando-cta" | "base-do-frame";

/**
 * Padrão "mosaico-de-cacos" (shapeClusterPattern): shapes adjacentes, sem sobreposição,
 * com 1 protagonista grande e coadjuvantes pequenos.
 */
export interface ShapeClusterLayer extends BaseLayer {
  type: "cluster";
  zone: ClusterZone;
  shapes: ClusterShape[];
}

export interface LogoLayer extends BaseLayer {
  type: "logo";
  /** Define a família do logo via logos.audienceRule (interno → Agi, externo → Agibank). */
  audience: Audience;
  midia: "digital" | "impresso";
  /** Distância da borda esquerda e da borda inferior. */
  margin: number;
  width: number;
}

export type Layer = BackgroundLayer | TextLayer | CtaLayer | ShapeClusterLayer | LogoLayer;

const MARGIN = 32;
const TEXT_WIDTH = CANVAS_SIZE * 0.85;

export const ALERTA_LAYERS: Layer[] = [
  { id: "fundo", label: "Fundo", type: "background", color: "azulAgibank" },
  {
    id: "cluster",
    label: "Cluster de shapes (sup. direito)",
    type: "cluster",
    zone: "canto-superior-direito-sangrando",
    shapes: [
      // Protagonista: sangra pelo canto superior direito.
      { file: "triangle-03.svg", color: "verde", mode: "fill", size: 140, rotation: 15, placement: { x: 563, y: 37 } },
      // Coadjuvantes (~40% do protagonista), encaixados em sequência: triângulo → quadrilátero → pentágono.
      { file: "quadrilateral-14.svg", color: "azulMedio", mode: "fill", size: 56, rotation: -10, placement: { adjacentTo: 0, angle: 140, gapPercent: 3 } },
      { file: "pentagon-02.svg", color: "branco", mode: "stroke", size: 50, rotation: 20, placement: { adjacentTo: 1, angle: 175, gapPercent: 3 } },
    ],
  },
  {
    id: "headline",
    label: "Headline",
    type: "text",
    role: "titulo",
    text: "Chega de complicar.",
    color: "verde",
    weight: "extraBold",
    fontSize: 48,
    lineHeight: 1.15,
    x: MARGIN,
    y: 196,
    width: TEXT_WIDTH,
  },
  {
    id: "corpo",
    label: "Corpo de texto",
    type: "text",
    role: "corpo",
    text: "Organize seus boletos em um só lugar e automatize pagamentos com o **Pix**!",
    color: "branco",
    weight: "regular",
    highlight: { color: "verde", weight: "bold" },
    fontSize: 22,
    lineHeight: 1.35,
    x: MARGIN,
    y: 264,
    // Abaixo do máximo de 85%: quebra equilibrada "…um só lugar / e automatize…" (o "e" desce por typographyLineBreakRules).
    width: 400,
  },
  {
    id: "cta",
    label: "CTA",
    type: "cta",
    text: "Acesse o app do Agi e confira as funções",
    color: "azulEscuro",
    weight: "semiBold",
    fontSize: 18,
    lineHeight: 1.2,
    x: MARGIN,
    y: 364,
    // Variante "pill-solid-accent": verde com texto azulEscuro (contrastMap.verde).
    pill: { color: "verde", paddingX: 28, paddingY: 18, shadow: "shadowSubtle" },
    trailingIcon: { file: "chevron-right.svg", size: 18, gap: 10 },
  },
  {
    id: "logo",
    label: "Logo",
    type: "logo",
    // Comunicação Interna (Alerta Sempre Juntos / Alerta Teams) → logo reduzido "Agi".
    audience: "interno",
    midia: "digital",
    margin: MARGIN,
    width: 80,
  },
];

export function getBackground(layers: Layer[]): BackgroundLayer | undefined {
  return layers.find((l): l is BackgroundLayer => l.type === "background");
}

export function getLogo(layers: Layer[]): LogoLayer | undefined {
  return layers.find((l): l is LogoLayer => l.type === "logo");
}
