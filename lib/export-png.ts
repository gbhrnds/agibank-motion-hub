import type Konva from "konva";

interface ExportOptions {
  fileName: string;
  size: number;
  /** Nomes de nós/camadas a ocultar durante o export (ex.: guias). */
  hideNames?: string[];
}

/** Exporta o Stage como PNG size×size (pixelRatio 1) e dispara o download no navegador. */
export function exportStageToPng(stage: Konva.Stage, { fileName, size, hideNames = [] }: ExportOptions) {
  const hidden = hideNames.flatMap((name) => stage.find(`.${name}`)).filter((node) => node.visible());
  hidden.forEach((node) => node.hide());
  let dataUrl: string;
  try {
    dataUrl = stage.toDataURL({ x: 0, y: 0, width: size, height: size, pixelRatio: 1, mimeType: "image/png" });
  } finally {
    hidden.forEach((node) => node.show());
  }

  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
