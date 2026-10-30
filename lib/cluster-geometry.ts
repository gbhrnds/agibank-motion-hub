/**
 * Medição do "mosaico-de-cacos" (shapeClusterPattern). As posições vêm de um preset fixo;
 * aqui só se mede o resultado: cada shape vira uma máscara de pixels da sua silhueta (contornos
 * contam com o interior), já girada/escalada, e `analyzeCluster` compara as silhuetas reais
 * (não as bboxes) para achar sobreposição e o vão entre peças.
 */

export interface MaskSource {
  image: HTMLImageElement;
  width: number;
  height: number;
  rotation: number;
  mirror: boolean;
}

interface Mask {
  /** Pixels preenchidos, relativos ao centro: chaves de `key(x, y)`. */
  filled: Set<number>;
  points: Int16Array;
  boundary: Int16Array;
}

const OFF = 2048;
const key = (x: number, y: number) => (x + OFF) * 4096 + (y + OFF);

export function buildMask({ image, width, height, rotation, mirror }: MaskSource): Mask {
  const side = Math.ceil(Math.hypot(width, height)) + 4;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = side;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.translate(side / 2, side / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.scale(mirror ? -1 : 1, 1);
  ctx.drawImage(image, -width / 2, -height / 2, width, height);
  const alpha = ctx.getImageData(0, 0, side, side).data;

  // Silhueta = tudo que não é alcançável a partir da borda passando por pixels vazios
  // (preenche o miolo dos shapes em contorno).
  const ink = new Uint8Array(side * side);
  for (let i = 0; i < ink.length; i++) ink[i] = alpha[i * 4 + 3] > 127 ? 1 : 0;
  const outside = new Uint8Array(side * side);
  const stack: number[] = [];
  for (let i = 0; i < side; i++) stack.push(i, (side - 1) * side + i, i * side, i * side + side - 1);
  while (stack.length) {
    const p = stack.pop()!;
    if (outside[p] || ink[p]) continue;
    outside[p] = 1;
    const x = p % side;
    const y = (p / side) | 0;
    if (x > 0) stack.push(p - 1);
    if (x < side - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - side);
    if (y < side - 1) stack.push(p + side);
  }

  const filled = new Set<number>();
  const pts: number[] = [];
  const bnd: number[] = [];
  const half = Math.floor(side / 2);
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < side && y < side && !outside[y * side + x];
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      if (!solid(x, y)) continue;
      const rx = x - half;
      const ry = y - half;
      filled.add(key(rx, ry));
      pts.push(rx, ry);
      if (!solid(x - 1, y) || !solid(x + 1, y) || !solid(x, y - 1) || !solid(x, y + 1)) bnd.push(rx, ry);
    }
  }
  return { filled, points: Int16Array.from(pts), boundary: Int16Array.from(bnd) };
}

/** Pixels de B (centro em b) que caem dentro de A (centro em a). */
function overlapPixels(A: Mask, a: Pt, B: Mask, b: Pt): number {
  const dx = Math.round(b.x) - Math.round(a.x);
  const dy = Math.round(b.y) - Math.round(a.y);
  let n = 0;
  for (let i = 0; i < B.points.length; i += 2) if (A.filled.has(key(B.points[i] + dx, B.points[i + 1] + dy))) n++;
  return n;
}

function minDistance(A: Mask, a: Pt, B: Mask, b: Pt): number {
  const dx = Math.round(b.x) - Math.round(a.x);
  const dy = Math.round(b.y) - Math.round(a.y);
  let best = Infinity;
  for (let i = 0; i < A.boundary.length; i += 2) {
    const ax = A.boundary[i];
    const ay = A.boundary[i + 1];
    for (let j = 0; j < B.boundary.length; j += 2) {
      const d = (B.boundary[j] + dx - ax) ** 2 + (B.boundary[j + 1] + dy - ay) ** 2;
      if (d < best) best = d;
    }
  }
  return Math.sqrt(best);
}

/** Pixels de borda encostados (distância 1) contam como "tocando", não como sobreposição. */
export const OVERLAP_TOLERANCE_PX = 2;

interface Pt {
  x: number;
  y: number;
}

export interface ClusterReport {
  sizes: number[];
  /** Pares com área preenchida sobreposta (acima da tolerância de antialias). */
  overlaps: { a: number; b: number; pixels: number }[];
  /** Menor distância entre silhuetas, para cada par. */
  gaps: { a: number; b: number; distance: number }[];
  /** Fração da silhueta de cada shape fora do frame. */
  bleed: number[];
}

export function analyzeCluster(masks: Mask[], positions: Pt[], sizes: number[], frame: number): ClusterReport {
  const overlaps: ClusterReport["overlaps"] = [];
  const gaps: ClusterReport["gaps"] = [];
  for (let a = 0; a < masks.length; a++) {
    for (let b = a + 1; b < masks.length; b++) {
      const pixels = overlapPixels(masks[a], positions[a], masks[b], positions[b]);
      if (pixels > OVERLAP_TOLERANCE_PX) overlaps.push({ a, b, pixels });
      gaps.push({ a, b, distance: pixels > OVERLAP_TOLERANCE_PX ? 0 : minDistance(masks[a], positions[a], masks[b], positions[b]) });
    }
  }
  const bleed = masks.map((m, i) => {
    const cx = Math.round(positions[i].x);
    const cy = Math.round(positions[i].y);
    let out = 0;
    for (let k = 0; k < m.points.length; k += 2) {
      const x = m.points[k] + cx;
      const y = m.points[k + 1] + cy;
      if (x < 0 || y < 0 || x >= frame || y >= frame) out++;
    }
    return m.points.length ? out / (m.points.length / 2) : 0;
  });
  return { sizes, overlaps, gaps, bleed };
}
