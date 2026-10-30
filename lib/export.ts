import type Konva from "konva";
import { brandTokens } from "./brand-tokens";
import type { Size } from "./piece-spec";

/** Formatos de assets-map.json → exportRules.formats. */
export type ExportFormat = "png" | "jpg" | "pdf";

interface ExportOptions {
  format: ExportFormat;
  /** Nome sem extensão. */
  baseName: string;
  /** Dimensões da peça (o preview pode estar reduzido; o arquivo sai no tamanho do formato). */
  size: Size;
  /** Nomes de nós/camadas a ocultar durante o export (ex.: guias). */
  hideNames?: string[];
}

interface FormatRule {
  mimeType?: string;
  quality?: number;
  pixelRatio?: number;
}

const rules = brandTokens.exportRules.formats as Record<ExportFormat, FormatRule>;

/**
 * Maior lado do arquivo rasterizado. Acima disso o pixelRatio de exportRules cai para 1: o A4 já é
 * 2480×3508 (300 dpi) e dobrar estoura o limite de canvas dos navegadores.
 */
const MAX_EXPORT_SIDE = 4096;

export function exportPixelRatio(format: Exclude<ExportFormat, "pdf">, size: Size): number {
  const ratio = rules[format].pixelRatio ?? 1;
  return Math.max(size.width, size.height) * ratio > MAX_EXPORT_SIDE ? 1 : ratio;
}

/** Rasteriza o Stage no tamanho real do formato (sem as guias), no formato pedido. */
export function renderStage(stage: Konva.Stage, format: Exclude<ExportFormat, "pdf">, size: Size, hideNames: string[] = []) {
  const rule = rules[format];
  const hidden = hideNames.flatMap((name) => stage.find(`.${name}`)).filter((node) => node.visible());
  // O preview desenha o Stage reduzido (scale); para exportar, volta ao tamanho real.
  const preview = { width: stage.width(), height: stage.height(), scale: stage.scale() };
  hidden.forEach((node) => node.hide());
  stage.size(size).scale({ x: 1, y: 1 });
  try {
    return stage.toDataURL({
      x: 0,
      y: 0,
      width: size.width,
      height: size.height,
      pixelRatio: exportPixelRatio(format, size),
      mimeType: rule.mimeType,
      quality: rule.quality,
    });
  } finally {
    stage.size({ width: preview.width, height: preview.height }).scale(preview.scale ?? { x: 1, y: 1 });
    hidden.forEach((node) => node.show());
  }
}

/**
 * Exporta a peça e dispara o download: PNG/JPG conforme exportRules (mimeType, quality, pixelRatio);
 * PDF com uma página do tamanho exato do frame e a imagem em alta resolução.
 */
export async function exportStage(stage: Konva.Stage, { format, baseName, size, hideNames = [] }: ExportOptions) {
  if (format === "pdf") {
    const { jsPDF } = await import("jspdf");
    const image = renderStage(stage, "png", size, hideNames);
    // Página com a dimensão exata do frame (1pt = 1px), como pede exportRules.formats.pdf.linkedinSpec.
    const pdf = new jsPDF({
      unit: "pt",
      format: [size.width, size.height],
      orientation: size.width > size.height ? "landscape" : "portrait",
      compress: true,
    });
    pdf.addImage(image, "PNG", 0, 0, size.width, size.height);
    pdf.save(`${baseName}.pdf`);
    return;
  }
  download(renderStage(stage, format, size, hideNames), `${baseName}.${format}`);
}

function download(href: string, fileName: string) {
  const link = document.createElement("a");
  link.href = href;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
