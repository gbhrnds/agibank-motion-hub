import type Konva from "konva";
import { brandTokens } from "./brand-tokens";

/** Formatos de assets-map.json → exportRules.formats. */
export type ExportFormat = "png" | "jpg" | "pdf";

interface ExportOptions {
  format: ExportFormat;
  /** Nome sem extensão. */
  baseName: string;
  size: number;
  /** Nomes de nós/camadas a ocultar durante o export (ex.: guias). */
  hideNames?: string[];
}

interface FormatRule {
  mimeType?: string;
  quality?: number;
  pixelRatio?: number;
}

const rules = brandTokens.exportRules.formats as Record<ExportFormat, FormatRule>;

/** Rasteriza o Stage (sem as guias) no formato pedido. */
export function renderStage(stage: Konva.Stage, format: Exclude<ExportFormat, "pdf">, size: number, hideNames: string[] = []) {
  const rule = rules[format];
  const hidden = hideNames.flatMap((name) => stage.find(`.${name}`)).filter((node) => node.visible());
  hidden.forEach((node) => node.hide());
  try {
    return stage.toDataURL({
      x: 0,
      y: 0,
      width: size,
      height: size,
      pixelRatio: rule.pixelRatio ?? 1,
      mimeType: rule.mimeType,
      quality: rule.quality,
    });
  } finally {
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
    const pdf = new jsPDF({ unit: "pt", format: [size, size], compress: true });
    pdf.addImage(image, "PNG", 0, 0, size, size);
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
