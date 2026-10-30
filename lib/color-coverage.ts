import type Konva from "konva";
import { colors, type ColorKey } from "./brand-tokens";

/**
 * Rasteriza o Stage (sem as guias) e conta, para cada pixel, a cor da paleta mais próxima.
 * Serve para checar dominância de cor (ex.: amarelo/verde nunca como fundo dominante).
 */
export function measureColorCoverage(
  stage: Konva.Stage,
  /** Área a amostrar, em px do Stage como está desenhado. */
  size: { width: number; height: number },
  hideNames: string[] = [],
): Partial<Record<ColorKey, number>> {
  const hidden = hideNames.flatMap((n) => stage.find(`.${n}`)).filter((n) => n.visible());
  hidden.forEach((n) => n.hide());
  let data: Uint8ClampedArray;
  try {
    const canvas = stage.toCanvas({ x: 0, y: 0, width: size.width, height: size.height, pixelRatio: 1 });
    data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
  } finally {
    hidden.forEach((n) => n.show());
  }

  const palette = (Object.keys(colors) as ColorKey[]).map((key) => {
    const n = parseInt(colors[key].replace("#", ""), 16);
    return { key, r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  });
  const counts = new Map<ColorKey, number>();
  const total = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    let best = palette[0];
    let bestD = Infinity;
    for (const p of palette) {
      const d = (data[i] - p.r) ** 2 + (data[i + 1] - p.g) ** 2 + (data[i + 2] - p.b) ** 2;
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    counts.set(best.key, (counts.get(best.key) ?? 0) + 1);
  }
  return Object.fromEntries([...counts].map(([k, v]) => [k, v / total]));
}
