import type Konva from "konva";
import { brandTokens } from "./brand-tokens";
import { convertCanvasToCMYKBuffer } from "./color-cmyk";
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
  /** PDF de impressão em CMYK real (Material Impresso). */
  cmyk?: boolean;
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

/** Roda `fn` com o Stage no tamanho real do formato (o preview o desenha reduzido) e as guias ocultas. */
function atNativeSize<T>(stage: Konva.Stage, size: Size, hideNames: string[], fn: () => T): T {
  const hidden = hideNames.flatMap((name) => stage.find(`.${name}`)).filter((node) => node.visible());
  const preview = { width: stage.width(), height: stage.height(), scale: stage.scale() };
  hidden.forEach((node) => node.hide());
  stage.size(size).scale({ x: 1, y: 1 });
  try {
    return fn();
  } finally {
    stage.size({ width: preview.width, height: preview.height }).scale(preview.scale ?? { x: 1, y: 1 });
    hidden.forEach((node) => node.show());
  }
}

/** Rasteriza o Stage no tamanho real do formato (sem as guias), no formato pedido. */
export function renderStage(stage: Konva.Stage, format: Exclude<ExportFormat, "pdf">, size: Size, hideNames: string[] = []) {
  const rule = rules[format];
  return atNativeSize(stage, size, hideNames, () =>
    stage.toDataURL({
      x: 0,
      y: 0,
      width: size.width,
      height: size.height,
      pixelRatio: exportPixelRatio(format, size),
      mimeType: rule.mimeType,
      quality: rule.quality,
    }),
  );
}

/**
 * Exporta a peça e dispara o download: PNG/JPG conforme exportRules (mimeType, quality, pixelRatio);
 * PDF com uma página do tamanho exato do frame e a imagem em alta resolução. Com `cmyk` (Material
 * Impresso), o PDF leva a imagem já em DeviceCMYK (exportCmykPdf).
 */
export async function exportStage(stage: Konva.Stage, { format, baseName, size, hideNames = [], cmyk = false }: ExportOptions) {
  if (format === "pdf") {
    if (cmyk) return exportCmykPdf(stage, { baseName, size, hideNames });
    return exportPdfPages([stage], { baseName, size, hideNames });
  }
  download(renderStage(stage, format, size, hideNames), `${baseName}.${format}`);
}

/**
 * PDF RGB com uma página por Stage, na ordem recebida, todas do mesmo tamanho (1px = 1pt).
 * Usado pelo carrossel (uma página por slide) e pelo PDF de peça única digital.
 */
export async function exportPdfPages(stages: Konva.Stage[], { baseName, size, hideNames = [] }: Omit<ExportOptions, "format">) {
  const { jsPDF } = await import("jspdf");
  const orientation = size.width > size.height ? "landscape" : "portrait";
  const pdf = new jsPDF({ unit: "pt", format: [size.width, size.height], orientation, compress: true });
  stages.forEach((stage, i) => {
    // Página com a dimensão exata do frame (1pt = 1px), como pede exportRules.formats.pdf.linkedinSpec.
    if (i > 0) pdf.addPage([size.width, size.height], orientation);
    pdf.addImage(renderStage(stage, "png", size, hideNames), "PNG", 0, 0, size.width, size.height);
  });
  pdf.save(`${baseName}.pdf`);
}

/**
 * PDF de impressão em CMYK real: o canvas é rasterizado, convertido pixel a pixel pela fonte única
 * de CMYK (lib/color-cmyk.ts — tabela das cores da marca para fundo, shapes, textos e logo; fórmula
 * padrão para fotos) e embutido como imagem /DeviceCMYK (8 bits, Flate) via pdf-lib.
 */
export async function exportCmykPdf(stage: Konva.Stage, { baseName, size, hideNames = [] }: Omit<ExportOptions, "format">) {
  const { PDFDocument, pushGraphicsState, popGraphicsState, concatTransformationMatrix, drawObject } = await import("pdf-lib");
  const ratio = exportPixelRatio("png", size);
  const canvas = atNativeSize(stage, size, hideNames, () =>
    stage.toCanvas({ x: 0, y: 0, width: size.width, height: size.height, pixelRatio: ratio }),
  );
  const pixels = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
  const cmyk = convertCanvasToCMYKBuffer(pixels);

  const doc = await PDFDocument.create();
  doc.setTitle(baseName);
  const page = doc.addPage([size.width, size.height]);
  const image = doc.context.flateStream(cmyk, {
    Type: "XObject",
    Subtype: "Image",
    Width: canvas.width,
    Height: canvas.height,
    ColorSpace: "DeviceCMYK",
    BitsPerComponent: 8,
  });
  const name = page.node.newXObject("ImCMYK", doc.context.register(image));
  page.pushOperators(
    pushGraphicsState(),
    concatTransformationMatrix(size.width, 0, 0, size.height, 0, 0),
    drawObject(name),
    popGraphicsState(),
  );
  const bytes = await doc.save();
  const url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "application/pdf" }));
  download(url, `${baseName}.pdf`);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function download(href: string, fileName: string) {
  const link = document.createElement("a");
  link.href = href;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
