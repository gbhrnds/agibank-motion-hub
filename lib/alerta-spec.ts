import type { Audience, ColorKey, FontWeightKey, IconFile, ShapeFile } from "./brand-tokens";

/**
 * Peça fixa do MVP: Alerta institucional de Comunicação Interna 600x600
 * (canais "Alerta Sempre Juntos" e "Alerta Teams").
 *
 * Só referencia CHAVES de config/assets-map.json (cores, pesos, arquivos) e nomes de
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

export interface Point {
  x: number;
  y: number;
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

export interface IconRowLayer extends BaseLayer {
  type: "icons";
  icons: IconFile[];
  color: ColorKey;
  size: number;
  gap: number;
  x: number;
  y: number;
}

export interface CtaLayer extends BaseLayer, TextStyle {
  type: "cta";
  text: string;
  fontSize: number;
  lineHeight: number;
  x: number;
  y: number;
  /** Caixa sólida atrás do texto (composition-patterns.json → ctaRules). Ausente = texto solto. */
  pill?: { color: ColorKey; paddingX: number; paddingY: number };
  trailingIcon?: { file: IconFile; size: number; gap: number };
}

/** Função do shape — nomes de composition-patterns.json → shapeUsageRules.patterns. */
export type ShapeFunction = "shape-sangrando-do-frame" | "linha-conectora-organica" | "moldura-organica-ao-redor-de-pessoa";

export interface ShapeLayer extends BaseLayer {
  type: "shape";
  file: ShapeFile;
  color: ColorKey;
  funcao?: ShapeFunction;
  x: number;
  y: number;
  width: number;
  rotation?: number;
}

/** Linha orgânica (stroke) ligando a borda direita de uma camada à de outra. */
export interface ConnectorLayer extends BaseLayer {
  type: "connector";
  funcao: "linha-conectora-organica";
  from: string;
  to: string;
  color: ColorKey;
  strokeWidth: number;
  /** Distância entre a borda da camada e a ponta da linha. */
  offset: number;
  /** Pontos intermediários da curva (suavizados com tension). */
  via: Point[];
  tension: number;
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

export type Layer =
  | BackgroundLayer
  | TextLayer
  | IconRowLayer
  | CtaLayer
  | ShapeLayer
  | ConnectorLayer
  | LogoLayer;

const MARGIN = 32;
const TEXT_WIDTH = CANVAS_SIZE * 0.85;

export const ALERTA_LAYERS: Layer[] = [
  { id: "fundo", label: "Fundo", type: "background", color: "azulAgibank" },
  {
    id: "shape-quadrilatero",
    label: "Shape quadrilátero (inf. esquerdo)",
    type: "shape",
    file: "quadrilateral-14.svg",
    color: "azulMedio",
    funcao: "shape-sangrando-do-frame",
    x: 176,
    y: 486,
    width: 200,
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
    y: 116,
    width: TEXT_WIDTH,
  },
  {
    id: "icones",
    label: "Ícones de apoio",
    type: "icons",
    icons: ["barcode.svg", "pix-transfer.svg"],
    color: "branco",
    size: 32,
    gap: 16,
    x: MARGIN,
    y: 194,
  },
  {
    id: "corpo",
    label: "Corpo de texto",
    type: "text",
    role: "corpo",
    text: "Organize seus boletos em um só lugar e automatize pagamentos com **Pix**!",
    color: "branco",
    weight: "regular",
    highlight: { color: "verde", weight: "bold" },
    fontSize: 22,
    lineHeight: 1.35,
    x: MARGIN,
    y: 254,
    width: TEXT_WIDTH,
  },
  {
    id: "cta",
    label: "CTA",
    type: "cta",
    text: "Acesse o app do Agi e confira as funções",
    color: "branco",
    weight: "semiBold",
    fontSize: 18,
    lineHeight: 1.2,
    x: MARGIN,
    y: 388,
    pill: { color: "azulEscuro", paddingX: 24, paddingY: 16 },
    trailingIcon: { file: "chevron-right.svg", size: 18, gap: 10 },
  },
  {
    id: "conector",
    label: "Linha conectora (ícones → CTA)",
    type: "connector",
    funcao: "linha-conectora-organica",
    from: "icones",
    to: "cta",
    color: "verde",
    strokeWidth: 2.5,
    offset: 14,
    via: [
      { x: 340, y: 212 },
      { x: 556, y: 230 },
      { x: 566, y: 350 },
      { x: 524, y: 414 },
    ],
    tension: 0.5,
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
