import type { Rect } from "./alerta-spec";

/**
 * Carrega um SVG de /public/assets como HTMLImageElement pronto para o Konva:
 * - opcionalmente recolore todos os preenchimentos para uma cor de marca;
 * - recorta o viewBox para a bbox real do desenho (os SVGs exportados têm margens);
 * - opcionalmente localiza um elemento de referência pela cor (ex.: pingo verde do "i").
 */

export interface SvgAsset {
  image: HTMLImageElement;
  /** Dimensões da bbox do desenho, em unidades do SVG original. */
  width: number;
  height: number;
  /** Bbox do elemento de referência, relativa à bbox do desenho. */
  reference: Rect | null;
}

export interface SvgAssetOptions {
  fill?: string;
  referenceFill?: string;
}

const RASTER_MAX = 1024;
const cache = new Map<string, Promise<SvgAsset>>();

export function loadSvgAsset(src: string, options: SvgAssetOptions = {}): Promise<SvgAsset> {
  const key = JSON.stringify([src, options.fill ?? null, options.referenceFill ?? null]);
  let pending = cache.get(key);
  if (!pending) {
    pending = build(src, options);
    pending.catch(() => cache.delete(key));
    cache.set(key, pending);
  }
  return pending;
}

async function build(src: string, { fill, referenceFill }: SvgAssetOptions): Promise<SvgAsset> {
  const res = await fetch(src);
  if (!res.ok) throw new Error(`Falha ao carregar ${src}: HTTP ${res.status}`);
  const doc = new DOMParser().parseFromString(await res.text(), "image/svg+xml");
  const svg = doc.documentElement as unknown as SVGSVGElement;
  if (svg.nodeName !== "svg") throw new Error(`${src} não é um SVG válido`);

  if (fill) recolor(svg, fill);

  // getBBox exige o elemento no documento renderizado.
  const host = document.createElement("div");
  host.style.cssText = "position:absolute;left:-99999px;top:0;visibility:hidden;pointer-events:none";
  const live = document.importNode(svg, true);
  host.appendChild(live);
  document.body.appendChild(host);

  let box: DOMRect;
  let reference: Rect | null = null;
  try {
    box = live.getBBox();
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

  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
  const image = await loadImage(url);
  return { image, width: box.width, height: box.height, reference };
}

function recolor(svg: SVGSVGElement, fill: string) {
  svg.setAttribute("fill", fill);
  svg.querySelectorAll("*").forEach((el) => {
    const attr = el.getAttribute("fill");
    if (attr && attr !== "none") el.setAttribute("fill", fill);
    const style = el.getAttribute("style");
    if (style) el.setAttribute("style", style.replace(/fill\s*:\s*(?!none)[^;]+/g, `fill: ${fill}`));
  });
  svg.querySelectorAll("style").forEach((s) => {
    s.textContent = (s.textContent ?? "").replace(/fill\s*:\s*(?!none)[^;}]+/g, `fill: ${fill}`);
  });
}

const DRAWABLE = "path, circle, ellipse, rect, polygon, polyline";
/** Distância RGB máxima para considerar "a mesma cor" (o logo usa #76df40, o token verde é #77DF40). */
const FILL_TOLERANCE = 24;

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
