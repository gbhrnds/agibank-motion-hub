import type { Rect } from "./piece-spec";
import { colors } from "./brand-tokens";
import { BRAND_COLOR_TOLERANCE, hexToRgb, nearestBrandColor } from "./color-cmyk";
import { applyColorToSvg, fetchSvg, svgToDataUrl, type ColorMode, type RecolorOptions } from "./svg-utils";

/**
 * Carrega um SVG da CDN (meta.cdnBase) como HTMLImageElement pronto para o Konva:
 * - opcionalmente recolore via recolorSvg() (fill sólido ou contorno);
 * - recorta o viewBox para a bbox real do desenho, contorno incluído (os SVGs exportados têm margens);
 * - opcionalmente localiza um elemento de referência pela cor (ex.: pingo verde do "i").
 */

export interface SvgAsset {
  image: HTMLImageElement;
  /** Dimensões da bbox do desenho, em unidades do SVG. */
  width: number;
  height: number;
  /** Bbox do elemento de referência, relativa à bbox do desenho. */
  reference: Rect | null;
}

export interface SvgAssetOptions {
  recolor?: { color: string; mode: ColorMode } & RecolorOptions;
  referenceFill?: string;
  /**
   * Troca cada preenchimento pela cor da marca mais próxima (lib/color-cmyk.ts). Usado nos logos CMYK:
   * o arquivo traz uma prévia RGB do CMYK (#b2d33e); a peça desenha a cor da marca e o PDF impresso
   * a converte pela tabela central de CMYK.
   */
  snapToBrand?: boolean;
}

const RASTER_MAX = 1024;
const cache = new Map<string, Promise<SvgAsset>>();

export function loadSvgAsset(src: string, options: SvgAssetOptions = {}): Promise<SvgAsset> {
  const key = JSON.stringify([src, options.recolor ?? null, options.referenceFill ?? null, options.snapToBrand ?? false]);
  let pending = cache.get(key);
  if (!pending) {
    pending = build(src, options);
    pending.catch(() => cache.delete(key));
    cache.set(key, pending);
  }
  return pending;
}

async function build(src: string, { recolor, referenceFill, snapToBrand }: SvgAssetOptions): Promise<SvgAsset> {
  // Recolore o próprio <svg> baixado (sem buscar de novo um data URL).
  const svg = await fetchSvg(src);
  if (recolor) applyColorToSvg(svg, recolor.color, recolor.mode, recolor);

  // getBBox exige o elemento no documento renderizado.
  const host = document.createElement("div");
  host.style.cssText = "position:absolute;left:-99999px;top:0;visibility:hidden;pointer-events:none";
  const live = document.importNode(svg, true);
  host.appendChild(live);
  document.body.appendChild(host);

  let box: { x: number; y: number; width: number; height: number };
  let reference: Rect | null = null;
  try {
    const b = live.getBBox();
    const pad = maxStrokeWidth(live) / 2;
    box = { x: b.x - pad, y: b.y - pad, width: b.width + pad * 2, height: b.height + pad * 2 };
    if (snapToBrand) {
      live.querySelectorAll<SVGGraphicsElement>(DRAWABLE).forEach((el) => {
        const rgb = parseCssRgb(getComputedStyle(el).fill);
        const key = rgb && nearestBrandColor(...rgb);
        if (key) el.style.fill = colors[key];
      });
    }
    if (referenceFill) {
      const el = findByFill(live, referenceFill);
      if (el) {
        const r = el.getBBox();
        reference = { x: r.x - box.x, y: r.y - box.y, width: r.width, height: r.height };
      }
    }
  } finally {
    host.remove();
  }

  // Com snapToBrand, as cores ajustadas estão no clone renderizado.
  const out = snapToBrand ? live : svg;
  const scale = RASTER_MAX / Math.max(box.width, box.height);
  out.setAttribute("viewBox", `${box.x} ${box.y} ${box.width} ${box.height}`);
  out.setAttribute("width", String(box.width * scale));
  out.setAttribute("height", String(box.height * scale));
  out.setAttribute("preserveAspectRatio", "xMidYMid meet");

  const image = await loadImage(svgToDataUrl(out));
  return { image, width: box.width, height: box.height, reference };
}

const DRAWABLE = "path, circle, ellipse, rect, polygon, polyline";
/** Mesma tolerância de cor da marca usada no export CMYK (lib/color-cmyk.ts). */
const FILL_TOLERANCE = BRAND_COLOR_TOLERANCE;

/** getBBox ignora contorno; somamos metade do maior stroke para não cortá-lo. */
function maxStrokeWidth(svg: SVGSVGElement): number {
  let max = 0;
  svg.querySelectorAll<SVGGraphicsElement>(DRAWABLE).forEach((el) => {
    const style = getComputedStyle(el);
    if (style.stroke && style.stroke !== "none") max = Math.max(max, parseFloat(style.strokeWidth) || 0);
  });
  return max;
}

function findByFill(svg: SVGSVGElement, hex: string): SVGGraphicsElement | null {
  const target = hexToRgb(hex);
  let best: { el: SVGGraphicsElement; d: number } | null = null;
  svg.querySelectorAll<SVGGraphicsElement>(DRAWABLE).forEach((el) => {
    const rgb = parseCssRgb(getComputedStyle(el).fill);
    if (!rgb) return;
    const d = Math.hypot(rgb[0] - target[0], rgb[1] - target[1], rgb[2] - target[2]);
    if (d <= FILL_TOLERANCE && (!best || d < best.d)) best = { el, d };
  });
  return best ? (best as { el: SVGGraphicsElement }).el : null;
}

function parseCssRgb(value: string): [number, number, number] | null {
  const m = value.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Falha ao decodificar SVG"));
    img.src = src;
  });
}
