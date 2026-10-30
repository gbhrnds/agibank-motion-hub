import { brandTokens as assetsMap, type ColorKey } from "./brand-tokens";

/**
 * Fonte única de CMYK do app: a tabela de equivalência HEX → CMYK das cores da marca e a fórmula
 * de conversão para o resto (fotos, bordas suavizadas). Usada pelo export de PDF impresso e pela
 * identificação de cores dos logos CMYK (LogoSmart / svg-asset).
 *
 * O assets-map.json ainda não traz valores CMYK oficiais. Quando trouxer, em `colorsCmyk`
 * ({ "azulAgibank": [c, m, y, k], … }, 0–100), eles têm prioridade; até lá cada cor é convertida
 * pela fórmula padrão a partir do HEX de `colors`.
 */

/** Componentes 0–1. */
export type Cmyk = [number, number, number, number];

/** Fórmula padrão RGB (0–255) → CMYK (0–1). */
export function rgbToCmyk(r: number, g: number, b: number): Cmyk {
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;
  const k = 1 - Math.max(R, G, B);
  if (k >= 1) return [0, 0, 0, 1];
  return [(1 - R - k) / (1 - k), (1 - G - k) / (1 - k), (1 - B - k) / (1 - k), k];
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const official = (assetsMap as { colorsCmyk?: Partial<Record<ColorKey, [number, number, number, number]>> }).colorsCmyk ?? {};

/** Tabela central de equivalência das cores da marca. */
export const CMYK_TABLE: Record<ColorKey, Cmyk> = Object.fromEntries(
  (Object.keys(assetsMap.colors) as ColorKey[]).map((key) => {
    const o = official[key];
    return [key, o ? (o.map((v) => v / 100) as Cmyk) : rgbToCmyk(...hexToRgb(assetsMap.colors[key]))];
  }),
) as Record<ColorKey, Cmyk>;

/**
 * Distância RGB máxima para considerar um pixel/preenchimento "a cor da marca": cobre a conversão dos
 * logos CMYK (verde #b2d33e ↔ token #77DF40, distância ~60; azul #007dc5 ↔ #0064F5, ~54).
 * Branco e azuis ficam a mais de 150 do verde.
 */
export const BRAND_COLOR_TOLERANCE = 72;

const palette = (Object.keys(assetsMap.colors) as ColorKey[]).map((key) => ({ key, rgb: hexToRgb(assetsMap.colors[key]) }));

/** Cor da marca mais próxima dentro da tolerância, ou null. */
export function nearestBrandColor(r: number, g: number, b: number, tolerance = BRAND_COLOR_TOLERANCE): ColorKey | null {
  let best: ColorKey | null = null;
  let bestD = tolerance * tolerance;
  for (const p of palette) {
    const d = (r - p.rgb[0]) ** 2 + (g - p.rgb[1]) ** 2 + (b - p.rgb[2]) ** 2;
    if (d <= bestD) {
      bestD = d;
      best = p.key;
    }
  }
  return best;
}

/**
 * Converte os pixels RGBA do canvas renderizado em CMYK (4 bytes por pixel):
 * - pixels de cor sólida da marca (fundo, shapes, logo, textos) → valor da CMYK_TABLE;
 * - demais pixels (fotos, bordas suavizadas) → fórmula padrão.
 * Transparência é composta sobre branco.
 */
export function convertCanvasToCMYKBuffer(data: Uint8ClampedArray): Uint8Array {
  const out = new Uint8Array((data.length / 4) * 4);
  const cache = new Map<number, number>();
  // Pixels "exatamente" da marca: tolerância curta, para não puxar tons de foto para a paleta.
  const SOLID = 6;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] / 255;
    const r = Math.round(data[i] * a + 255 * (1 - a));
    const g = Math.round(data[i + 1] * a + 255 * (1 - a));
    const b = Math.round(data[i + 2] * a + 255 * (1 - a));
    const packed = (r << 16) | (g << 8) | b;
    let cmyk = cache.get(packed);
    if (cmyk === undefined) {
      const key = nearestBrandColor(r, g, b, SOLID);
      const [c, m, y, k] = key ? CMYK_TABLE[key] : rgbToCmyk(r, g, b);
      cmyk = ((Math.round(c * 255) << 24) | (Math.round(m * 255) << 16) | (Math.round(y * 255) << 8) | Math.round(k * 255)) >>> 0;
      if (cache.size < 200_000) cache.set(packed, cmyk);
    }
    out[i] = cmyk >>> 24;
    out[i + 1] = (cmyk >>> 16) & 255;
    out[i + 2] = (cmyk >>> 8) & 255;
    out[i + 3] = cmyk & 255;
  }
  return out;
}
