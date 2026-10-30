import type { ImagePlacement, Rect } from "./piece-spec";

/**
 * Máscaras de recorte da imagem enviada: polígonos irregulares grandes, na linguagem das formas
 * irregulares da marca. Pontos normalizados para a imagem na metade DIREITA: x = 0 é a borda
 * interna (perto do texto) e x = 1 a borda da peça; valores fora de 0–1 sangram para fora do canvas.
 * Para a metade de cima, o polígono é girado (a borda da peça vira o topo).
 */
export interface ImageMask {
  id: string;
  points: [number, number][];
}

export const IMAGE_MASKS: ImageMask[] = [
  { id: "pentagono", points: [[0.18, -0.05], [1.05, -0.05], [1.05, 1.05], [0.38, 1.05], [0.02, 0.55]] },
  { id: "trapezio", points: [[0.32, -0.05], [1.05, -0.05], [1.05, 1.05], [0.04, 1.05]] },
  { id: "hexagono-irregular", points: [[0.26, -0.05], [1.05, -0.05], [1.05, 1.05], [0.46, 1.05], [0.06, 0.72], [0.0, 0.3]] },
  { id: "diagonal", points: [[0.55, -0.05], [1.05, -0.05], [1.05, 1.05], [0.02, 1.05]] },
];

export function pickMask(seed: number): ImageMask {
  return IMAGE_MASKS[(seed >>> 0) % IMAGE_MASKS.length];
}

/** Polígono em px da peça (lista plana x0, y0, x1, y1…). */
export function maskPolygon(mask: ImageMask, region: Rect, placement: ImagePlacement): number[] {
  return mask.points.flatMap(([u, v]) =>
    placement === "right"
      ? [region.x + u * region.width, region.y + v * region.height]
      : // Girado: a borda da peça (u = 1) vai para o topo; o lado irregular (u = 0) fica embaixo.
        [region.x + v * region.width, region.y + (1 - u) * region.height],
  );
}

/** Recorte "cover": a imagem preenche o retângulo sem distorcer. */
export function coverFit(imgW: number, imgH: number, box: Rect) {
  const k = Math.max(box.width / imgW, box.height / imgH);
  const width = imgW * k;
  const height = imgH * k;
  return { x: box.x + (box.width - width) / 2, y: box.y + (box.height - height) / 2, width, height };
}
