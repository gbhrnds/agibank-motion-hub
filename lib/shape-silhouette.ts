/**
 * Silhueta de cada shape SVG como grade N×N (1 = preenchido), carregada uma vez por arquivo.
 * Permite testar colisões com a forma real (triângulos, pentágonos) — a bbox de um shape gigante
 * e girado cobriria quase o canvas inteiro. Contornos contam com o interior.
 */

import type { Rect } from "./alerta-spec";

export interface Silhouette {
  file: string;
  /** Resolução da grade. */
  n: number;
  grid: Uint8Array;
  /** Proporção do desenho com a maior dimensão = 1. */
  w: number;
  h: number;
  /** Centros das células de borda e preenchidas (amostradas), em coordenadas locais normalizadas [-0.5, 0.5]. */
  boundary: Float32Array;
  cells: Float32Array;
}

/** Shape posicionado: centro em px, maior dimensão `size` em px, rotação em graus (horário). */
export interface PlacedShape {
  file: string;
  x: number;
  y: number;
  size: number;
  rotation: number;
}

/** Monta a silhueta a partir de uma grade alfa (n×n, já com o desenho centrado e maior dimensão = n). */
export function silhouetteFromGrid(file: string, n: number, grid: Uint8Array, w: number, h: number): Silhouette {
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < n && y < n && grid[y * n + x] === 1;
  const bnd: number[] = [];
  const cells: number[] = [];
  const step = Math.max(1, Math.round(n / 48));
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!solid(x, y)) continue;
      const u = (x + 0.5) / n - 0.5;
      const v = (y + 0.5) / n - 0.5;
      if (!solid(x - 1, y) || !solid(x + 1, y) || !solid(x, y - 1) || !solid(x, y + 1)) bnd.push(u, v);
      if (x % step === 0 && y % step === 0) cells.push(u, v);
    }
  }
  return { file, n, grid, w, h, boundary: Float32Array.from(bnd), cells: Float32Array.from(cells) };
}

const toLocal = (s: PlacedShape, px: number, py: number) => {
  const r = (s.rotation * Math.PI) / 180;
  const dx = px - s.x;
  const dy = py - s.y;
  return { u: (dx * Math.cos(r) + dy * Math.sin(r)) / s.size, v: (-dx * Math.sin(r) + dy * Math.cos(r)) / s.size };
};

const toCanvas = (s: PlacedShape, u: number, v: number) => {
  const r = (s.rotation * Math.PI) / 180;
  const lx = u * s.size;
  const ly = v * s.size;
  return { x: s.x + lx * Math.cos(r) - ly * Math.sin(r), y: s.y + lx * Math.sin(r) + ly * Math.cos(r) };
};

/** O ponto (px, py) do canvas cai dentro da silhueta do shape? */
export function contains(sil: Silhouette, s: PlacedShape, px: number, py: number): boolean {
  const { u, v } = toLocal(s, px, py);
  const gx = Math.floor((u + 0.5) * sil.n);
  const gy = Math.floor((v + 0.5) * sil.n);
  return gx >= 0 && gy >= 0 && gx < sil.n && gy < sil.n && sil.grid[gy * sil.n + gx] === 1;
}

/** Algum pixel da silhueta (com folga `margin`) cai no retângulo? */
export function hitsRect(sil: Silhouette, s: PlacedShape, rect: Rect, margin = 0): boolean {
  const x0 = rect.x - margin;
  const y0 = rect.y - margin;
  const x1 = rect.x + rect.width + margin;
  const y1 = rect.y + rect.height + margin;
  // Descarte rápido pelo círculo que envolve o shape.
  const radius = (s.size * Math.SQRT2) / 2;
  if (s.x + radius < x0 || s.x - radius > x1 || s.y + radius < y0 || s.y - radius > y1) return false;
  const step = Math.max(1.5, Math.min(4, s.size / sil.n));
  for (let y = y0; y <= y1; y += step) for (let x = x0; x <= x1; x += step) if (contains(sil, s, x, y)) return true;
  return false;
}

/** Menor distância (px) entre as bordas de dois shapes; 0 se as áreas se sobrepõem. */
export function gapBetween(silA: Silhouette, a: PlacedShape, silB: Silhouette, b: PlacedShape): number {
  if (overlaps(silA, a, silB, b)) return 0;
  const pa = boundaryPoints(silA, a, 160);
  const pb = boundaryPoints(silB, b, 160);
  let best = Infinity;
  for (let i = 0; i < pa.length; i += 2) {
    for (let j = 0; j < pb.length; j += 2) {
      const d = (pa[i] - pb[j]) ** 2 + (pa[i + 1] - pb[j + 1]) ** 2;
      if (d < best) best = d;
    }
  }
  // Os pontos ficam no centro das células de borda: desconta meia célula de cada lado.
  return Math.max(0, Math.sqrt(best) - (a.size / silA.n + b.size / silB.n) / 2);
}

/** As áreas preenchidas se sobrepõem? */
export function overlaps(silA: Silhouette, a: PlacedShape, silB: Silhouette, b: PlacedShape): boolean {
  const ra = (a.size * Math.SQRT2) / 2;
  const rb = (b.size * Math.SQRT2) / 2;
  if (Math.hypot(a.x - b.x, a.y - b.y) > ra + rb) return false;
  const [small, smallSil, big, bigSil] = a.size <= b.size ? [a, silA, b, silB] : [b, silB, a, silA];
  for (let i = 0; i < smallSil.cells.length; i += 2) {
    const p = toCanvas(small, smallSil.cells[i], smallSil.cells[i + 1]);
    if (contains(bigSil, big, p.x, p.y)) return true;
  }
  for (let i = 0; i < smallSil.boundary.length; i += 2) {
    const p = toCanvas(small, smallSil.boundary[i], smallSil.boundary[i + 1]);
    if (contains(bigSil, big, p.x, p.y)) return true;
  }
  return false;
}

/** Pontos de borda no canvas (no máximo `max` pontos), como [x0, y0, x1, y1, ...]. */
export function boundaryPoints(sil: Silhouette, s: PlacedShape, max: number): number[] {
  const total = sil.boundary.length / 2;
  const step = Math.max(1, Math.floor(total / max));
  const out: number[] = [];
  for (let i = 0; i < total; i += step) {
    const p = toCanvas(s, sil.boundary[i * 2], sil.boundary[i * 2 + 1]);
    out.push(p.x, p.y);
  }
  return out;
}

/** Fração do canvas (size×size) coberta pela silhueta. */
export function canvasCoverage(sil: Silhouette, s: PlacedShape, canvasSize: number, step = 8): number {
  let hit = 0;
  let total = 0;
  for (let y = step / 2; y < canvasSize; y += step) {
    for (let x = step / 2; x < canvasSize; x += step) {
      total++;
      if (contains(sil, s, x, y)) hit++;
    }
  }
  return hit / total;
}

// ---- Carregamento no navegador ----

const GRID = 128;
const cache = new Map<string, Silhouette>();

export function getSilhouette(file: string): Silhouette | undefined {
  return cache.get(file);
}

/** Rasteriza a forma preenchida (sem recolorir para outline) e guarda a grade. */
export async function loadSilhouette(file: string, src: string): Promise<Silhouette> {
  const hit = cache.get(file);
  if (hit) return hit;
  const { loadSvgAsset } = await import("./svg-asset");
  const asset = await loadSvgAsset(src, { recolor: { color: "#000000", mode: "fill" } });
  const max = Math.max(asset.width, asset.height);
  const w = asset.width / max;
  const h = asset.height / max;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = GRID;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(asset.image, ((1 - w) * GRID) / 2, ((1 - h) * GRID) / 2, w * GRID, h * GRID);
  const alpha = ctx.getImageData(0, 0, GRID, GRID).data;
  const grid = new Uint8Array(GRID * GRID);
  for (let i = 0; i < grid.length; i++) grid[i] = alpha[i * 4 + 3] > 127 ? 1 : 0;
  const sil = silhouetteFromGrid(file, GRID, grid, w, h);
  cache.set(file, sil);
  return sil;
}
