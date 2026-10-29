// No build estático (página publicada em sandbox), downloads disparados por script
// são bloqueados. O PNG é gerado do mesmo jeito e mostrado num painel para salvar.
import type Konva from "konva";

interface ExportOptions {
  fileName: string;
  size: number;
  hideNames?: string[];
}

export function exportStageToPng(stage: Konva.Stage, { fileName, size, hideNames = [] }: ExportOptions) {
  const hidden = hideNames.flatMap((name) => stage.find(`.${name}`)).filter((node) => node.visible());
  hidden.forEach((node) => node.hide());
  let dataUrl: string;
  try {
    dataUrl = stage.toDataURL({ x: 0, y: 0, width: size, height: size, pixelRatio: 1, mimeType: "image/png" });
  } finally {
    hidden.forEach((node) => node.show());
  }

  document.getElementById("export-preview")?.remove();
  const overlay = document.createElement("div");
  overlay.id = "export-preview";
  overlay.innerHTML = `
    <div class="export-card" role="dialog" aria-label="PNG exportado">
      <p class="export-title">${fileName} · ${size}×${size}px</p>
      <img alt="PNG exportado" width="${size}" height="${size}" />
      <p class="export-hint">Clique com o botão direito (ou toque e segure) na imagem e escolha "Salvar imagem como…".</p>
      <button type="button">Fechar</button>
    </div>`;
  overlay.querySelector("img")!.src = dataUrl;
  overlay.querySelector("button")!.addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => e.target === overlay && overlay.remove());
  document.body.appendChild(overlay);
}
