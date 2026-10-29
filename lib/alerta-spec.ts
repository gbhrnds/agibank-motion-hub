import type { ColorKey, FontWeightKey, IconFile, ShapeFile } from "./brand-tokens";

/**
 * Peça fixa do MVP: Alerta institucional de Comunicação Interna 600x600
 * (canais "Alerta Sempre Juntos" e "Alerta Teams").
 *
 * Só referencia CHAVES de config/assets-map.json (cores, pesos, arquivos);
 * os valores concretos são resolvidos por lib/brand-tokens.ts.
 */

export const CANVAS_SIZE = 600;
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

export interface TextLayer extends BaseLayer {
  type: "text";
  text: string;
  color: ColorKey;
  weight: FontWeightKey;
  fontSize: number;
  lineHeight: number;
  x: number;
  y: number;
  /** Largura máxima (quebra automática). Ausente = linha única com largura natural. */
  width?: number;
  trailingIcon?: { file: IconFile; size: number; gap: number };
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

export interface ShapeLayer extends BaseLayer {
  type: "shape";
  file: ShapeFile;
  color: ColorKey;
  x: number;
  y: number;
  width: number;
  rotation?: number;
}

export interface LogoLayer extends BaseLayer {
  type: "logo";
  brand: "agi" | "agibank";
  midia: "digital" | "impresso";
  /** Distância da borda esquerda e da borda inferior. */
  margin: number;
  width: number;
}

export type Layer = BackgroundLayer | TextLayer | IconRowLayer | ShapeLayer | LogoLayer;

const MARGIN = 32;

export const ALERTA_LAYERS: Layer[] = [
  { id: "fundo", label: "Fundo", type: "background", color: "azulAgibank" },
  {
    id: "shape-triangulo",
    label: "Shape triângulo (sup. direito)",
    type: "shape",
    file: "triangle-03.svg",
    color: "azulMedio",
    x: 420,
    y: -72,
    width: 230,
  },
  {
    id: "shape-quadrilatero",
    label: "Shape quadrilátero (inf. esquerdo)",
    type: "shape",
    file: "quadrilateral-14.svg",
    color: "azulMedio",
    x: 214,
    y: 506,
    width: 150,
  },
  {
    id: "headline",
    label: "Headline",
    type: "text",
    text: "Chega de complicar.",
    color: "branco",
    weight: "extraBold",
    fontSize: 44,
    lineHeight: 1.15,
    x: MARGIN,
    y: 124,
    width: CANVAS_SIZE * 0.85,
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
    y: 198,
  },
  {
    id: "corpo",
    label: "Corpo de texto",
    type: "text",
    text: "Organize seus boletos em um só lugar e automatize pagamentos com Pix!",
    color: "branco",
    weight: "regular",
    fontSize: 22,
    lineHeight: 1.35,
    x: MARGIN,
    y: 258,
    width: CANVAS_SIZE * 0.85,
  },
  {
    id: "cta",
    label: "CTA",
    type: "text",
    text: "Acesse o app do Agi e confira as funções",
    color: "branco",
    weight: "semiBold",
    fontSize: 18,
    lineHeight: 1.3,
    x: MARGIN,
    y: 448,
    trailingIcon: { file: "chevron-right.svg", size: 20, gap: 8 },
  },
  {
    id: "logo",
    label: "Logo",
    type: "logo",
    brand: "agibank",
    midia: "digital",
    margin: MARGIN,
    width: 140,
  },
];

export function getBackground(layers: Layer[]): BackgroundLayer | undefined {
  return layers.find((l): l is BackgroundLayer => l.type === "background");
}
