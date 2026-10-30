// Na página publicada (sandbox), downloads disparados por script são bloqueados.
// PNG/JPG: a imagem é gerada igual ao app e mostrada num painel para salvar.
// PDF: só baixa no app local.
import type Konva from "konva";
import { renderStage, type ExportFormat } from "../../lib/export";
import type { Size } from "../../lib/piece-spec";

export type { ExportFormat };

interface ExportOptions {
  format: ExportFormat;
  baseName: string;
  size: Size;
  hideNames?: string[];
  cmyk?: boolean;
}

const PDF_HINT = "Esta página publicada não permite downloads. Para baixar o PDF, use o app local (npm run dev).";

/** Carrossel: o PDF de várias páginas também só baixa no app local. */
export async function exportPdfPages(stages: Konva.Stage[], { baseName, size }: Omit<ExportOptions, "format">) {
  return exportStage(stages[0], { format: "pdf", baseName: `${baseName} (${stages.length} páginas)`, size });
}

export async function exportStage(stage: Konva.Stage, { format, baseName, size, hideNames = [] }: ExportOptions) {
  document.getElementById("export-preview")?.remove();
  const overlay = document.createElement("div");
  overlay.id = "export-preview";
  const card = document.createElement("div");
  card.className = "export-card";
  card.setAttribute("role", "dialog");
  const title = document.createElement("p");
  title.className = "export-title";
  const hint = document.createElement("p");
  hint.className = "export-hint";

  if (format === "pdf") {
    title.textContent = `${baseName}.pdf`;
    hint.textContent = PDF_HINT;
    card.append(title, hint);
  } else {
    const url = renderStage(stage, format, size, hideNames);
    const img = document.createElement("img");
    img.alt = `${format.toUpperCase()} exportado`;
    img.src = url;
    img.onload = () => (title.textContent = `${baseName}.${format} · ${img.naturalWidth}×${img.naturalHeight}px`);
    title.textContent = `${baseName}.${format}`;
    hint.textContent = 'Clique com o botão direito (ou toque e segure) na imagem e escolha "Salvar imagem como…".';
    card.append(title, img, hint);
  }
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "Fechar";
  close.addEventListener("click", () => overlay.remove());
  card.append(close);
  overlay.append(card);
  overlay.addEventListener("click", (e) => e.target === overlay && overlay.remove());
  document.body.appendChild(overlay);
}
