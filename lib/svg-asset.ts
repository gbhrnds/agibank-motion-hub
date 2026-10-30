import type { Rect } from "./alerta-spec";
import { parseSvg, recolorSvg, svgToDataUrl, type ColorMode, type RecolorOptions } from "./svg-utils";

/**
 * Carrega um SVG de /public/assets como HTMLImageElement pronto para o Konva:
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
}

const RASTER_MAX = 1024;
const cache = new Map<string, Promise<SvgAsset>>();

export function loadSvgAsset(src: string, options: SvgAssetOptions = {}): Promise<SvgAsset> {
  const key = JSON.stringify([src, options.recolor ?? null, options.referenceFill ?? null]);
  let pending = cache.get(key);
  if (!pending) {
    pending = build(src, options);
    pending.catch(() => cache.delete(key));
    cache.set(key, pending);
  }
  return pending;
}

async function build(src: string, { recolor, referenceFill }: SvgAssetOptions): Promise<SvgAsset> {
  const url = recolor ? await recolorSvg(src, recolor.color, recolor.mode, recolor) : src;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao carregar ${src}: HTTP ${res.status}`);
  const svg = parseSvg(await res.text(), src);

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

  const scale = RASTER_MAX / Math.max(box.width, box.height);
  svg.setAttribute("viewBox", `${box.x} ${box.y} ${box.width} ${box.height}`);
  svg.setAttribute("width", String(box.width * scale));
  svg.setAttribute("height", String(box.height * scale));
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

  const image = await loadImage(svgToDataUrl(svg));
  return { image, width: box.width, height: box.height, reference };
}

const DRAWABLE = "path, circle, ellipse, rect, polygon, polyline";
/** Distância RGB máxima para considerar "a mesma cor" (o logo agibank usa #76df40, o token verde é #77DF40). */
const FILL_TOLERANCE = 24;

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

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
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
