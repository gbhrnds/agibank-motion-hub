/**
 * Recolore SVGs de /public/assets em tempo de execução, para não duplicar arquivos por cor.
 * Os shapes vêm com fill azul fixo no markup; os ícones, com fill escuro em `style`.
 */

export type ColorMode = "fill" | "stroke";

export interface RecolorOptions {
  /**
   * Espessura do contorno no modo "stroke". Em px da peça quando `targetSize` é informado
   * (convertida para unidades do viewBox); senão, em unidades do SVG. Padrão: 2.
   */
  strokeWidth?: number;
  /** Maior dimensão, em px, com que o SVG será desenhado. */
  targetSize?: number;
}

const DRAWABLE = "path, polygon, polyline, circle, ellipse, rect, line";

/** Aplica a cor num <svg> já parseado (fill sólido ou contorno sem preenchimento). */
export function applyColorToSvg(svg: SVGSVGElement, color: string, mode: ColorMode, options: RecolorOptions = {}) {
  svg.querySelectorAll("style").forEach((s) => {
    s.textContent = (s.textContent ?? "").replace(/fill\s*:\s*(?!none)[^;}]+/g, `fill: ${mode === "fill" ? color : "none"}`);
  });
  const stripFill = (el: Element) => {
    const style = el.getAttribute("style");
    if (style) el.setAttribute("style", style.replace(/fill\s*:\s*[^;]+;?/g, "").trim());
  };

  if (mode === "fill") {
    svg.setAttribute("fill", color);
    svg.querySelectorAll("*").forEach((el) => {
      const attr = el.getAttribute("fill");
      if (attr && attr !== "none") el.setAttribute("fill", color);
      const style = el.getAttribute("style");
      if (style) el.setAttribute("style", style.replace(/fill\s*:\s*(?!none)[^;]+/g, `fill: ${color}`));
    });
    return;
  }

  const width = strokeWidthInUnits(svg, options);
  svg.setAttribute("fill", "none");
  svg.querySelectorAll(DRAWABLE).forEach((el) => {
    stripFill(el);
    el.setAttribute("fill", "none");
    el.setAttribute("stroke", color);
    el.setAttribute("stroke-width", String(width));
    el.setAttribute("stroke-linejoin", "round");
  });
  // Metade do contorno fica fora da geometria: amplia o viewBox para não cortar.
  const vb = viewBox(svg);
  if (vb) {
    const pad = width / 2;
    svg.setAttribute("viewBox", `${vb.x - pad} ${vb.y - pad} ${vb.width + width} ${vb.height + width}`);
  }
}

/**
 * Busca o SVG, recolore (fill: troca todos os preenchimentos; stroke: fill="none" + contorno)
 * e devolve um data URL base64 (data:image/svg+xml;base64,...).
 */
export async function recolorSvg(
  svgPath: string,
  newColor: string,
  mode: ColorMode,
  options: RecolorOptions = {},
): Promise<string> {
  const res = await fetch(svgPath);
  if (!res.ok) throw new Error(`Falha ao carregar ${svgPath}: HTTP ${res.status}`);
  const svg = parseSvg(await res.text(), svgPath);
  applyColorToSvg(svg, newColor, mode, options);
  return svgToDataUrl(svg);
}

export function parseSvg(markup: string, source = "SVG"): SVGSVGElement {
  const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
  const svg = doc.documentElement as unknown as SVGSVGElement;
  if (svg.nodeName !== "svg") throw new Error(`${source} não é um SVG válido`);
  return svg;
}

export function svgToDataUrl(svg: SVGSVGElement): string {
  const bytes = new TextEncoder().encode(new XMLSerializer().serializeToString(svg));
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return `data:image/svg+xml;base64,${btoa(binary)}`;
}

function viewBox(svg: SVGSVGElement) {
  const parts = (svg.getAttribute("viewBox") ?? "").trim().split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || parts.some(Number.isNaN)) return null;
  const [x, y, width, height] = parts;
  return { x, y, width, height };
}

function strokeWidthInUnits(svg: SVGSVGElement, { strokeWidth = 2, targetSize }: RecolorOptions): number {
  const vb = viewBox(svg);
  if (!targetSize || !vb) return strokeWidth;
  return (strokeWidth * Math.max(vb.width, vb.height)) / targetSize;
}
