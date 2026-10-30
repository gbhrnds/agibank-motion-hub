/**
 * Motor de geração dinâmica de layouts (composition-patterns.json → dynamicShapeArrangements).
 *
 * `generateRandomLayout()` sorteia um arquétipo, os SVGs (shapes.byType do assets-map.json), as
 * cores (colorMix.allowedCombos) e calcula x, y, escala e rotação de cada shape. Cada candidato é
 * testado contra a silhueta real dos shapes: nada pode cair sobre textos, CTA ou a área de proteção
 * do logo, e shapes do mesmo arranjo não se sobrepõem. Candidatos ruins são descartados e sorteados de novo.
 */

import type { Rect } from "./alerta-spec";
import { brandTokens, type ColorKey } from "./brand-tokens";
import { amareloMaxScale, archetype, colorCombos, type ArchetypeId, type ArchetypeSpec, type Range } from "./composition-tokens";
import {
  boundaryPoints,
  canvasCoverage,
  gapBetween,
  hitsRect,
  overlaps,
  type PlacedShape,
  type Silhouette,
} from "./shape-silhouette";
import type { ColorMode } from "./svg-utils";

/** Maior dimensão de um shape com scale 1.0, em px. */
export const SHAPE_UNIT = 130;
const CANVAS = 600;
/** Folga mínima entre um shape e textos/CTA/área do logo. */
const KEEP_OUT_MARGIN = 10;
/** Folga mínima entre shapes de um mesmo arranjo que não se tocam. */
const SHAPE_SPACING = 10;
/** Estouro de canto: quanto do canvas a ponta do shape gigante pode cobrir. */
const BLEED_COVERAGE: Range = [0.05, 0.22];

/** Arquétipos que o motor sorteia ("mascara-de-foto" fica de fora até existir upload de imagem). */
export const GENERATED_ARCHETYPES: ArchetypeId[] = ["estouro-de-canto", "mosaico-dupla", "textura-espalhada"];

export interface GeneratedShape {
  file: string;
  color: ColorKey;
  mode: ColorMode;
  scale: number;
  x: number;
  y: number;
  rotation: number;
  role: "protagonista" | "coadjuvante" | "textura";
}

export interface GeneratedLayout {
  archetype: ArchetypeId;
  seed: number;
  /** Nomes de colorMix.allowedCombos usados. */
  combo: string[];
  shapes: GeneratedShape[];
}

export interface KeepOutZone {
  label: string;
  rect: Rect;
}

export interface GenerateOptions {
  /** Áreas que nenhum shape pode tocar (textos, CTA, área de proteção do logo). */
  keepOut: KeepOutZone[];
  /** Silhueta de cada arquivo de shape (ver loadSilhouette). */
  silhouettes: Record<string, Silhouette>;
  seed?: number;
  /** Força um arquétipo (útil em testes). */
  archetype?: ArchetypeId;
}

export const allShapeFiles: string[] = Object.values(brandTokens.shapes.byType).flat();

/** PRNG determinístico (mulberry32): o mesmo seed gera o mesmo layout. */
export function seededRandom(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = () => number;
const between = (rng: Rng, [a, b]: Range) => a + rng() * (b - a);
const intBetween = (rng: Rng, [a, b]: Range) => a + Math.floor(rng() * (b - a + 1));
const pick = <T>(rng: Rng, list: T[]): T => list[Math.floor(rng() * list.length)];
const round = (v: number, d = 1) => Math.round(v * 10 ** d) / 10 ** d;

export function generateRandomLayout(options: GenerateOptions): GeneratedLayout {
  const seed = options.seed ?? Math.floor(Math.random() * 2 ** 31);
  const rng = seededRandom(seed);
  const order = options.archetype ? [options.archetype] : shuffle(rng, GENERATED_ARCHETYPES);
  for (const id of order) {
    for (let attempt = 0; attempt < 40; attempt++) {
      const layout = tryArchetype(rng, archetype(id), options);
      if (layout) return { ...layout, seed };
    }
  }
  throw new Error("Não foi possível gerar um layout que respeite textos, CTA e logo.");
}

function shuffle<T>(rng: Rng, list: T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

interface Draft {
  file: string;
  scale: number;
  x: number;
  y: number;
  rotation: number;
  role: GeneratedShape["role"];
}

const placed = (d: Draft): PlacedShape => ({ file: d.file, x: d.x, y: d.y, size: d.scale * SHAPE_UNIT, rotation: d.rotation });

function tryArchetype(
  rng: Rng,
  spec: ArchetypeSpec,
  opts: GenerateOptions,
): Omit<GeneratedLayout, "seed"> | null {
  const drafts =
    spec.id === "estouro-de-canto"
      ? estouroDeCanto(rng, spec, opts)
      : spec.id === "mosaico-dupla"
        ? mosaicoDupla(rng, spec, opts)
        : texturaEspalhada(rng, spec, opts);
  if (!drafts) return null;
  const colored = assignColors(rng, drafts);
  if (!colored) return null;
  return { archetype: spec.id, combo: colored.combo, shapes: colored.shapes };
}

/** O shape respeita textos/CTA/logo e não toca os shapes já aceitos? */
function fits(d: Draft, accepted: Draft[], opts: GenerateOptions, spacing = SHAPE_SPACING): boolean {
  const sil = opts.silhouettes[d.file];
  const p = placed(d);
  if (opts.keepOut.some((z) => hitsRect(sil, p, z.rect, KEEP_OUT_MARGIN))) return false;
  return accepted.every((o) => gapBetween(opts.silhouettes[o.file], placed(o), sil, p) >= spacing);
}

// ---- Estouro de canto: 1 shape gigante com o centro fora do canvas + 1-2 pequenos no canto oposto ----

const CORNERS = [
  { x: 0, y: 0 },
  { x: CANVAS, y: 0 },
  { x: CANVAS, y: CANVAS },
  { x: 0, y: CANVAS },
];

function estouroDeCanto(rng: Rng, spec: ArchetypeSpec, opts: GenerateOptions): Draft[] | null {
  const corner = intBetween(rng, [0, 3]);
  const c = CORNERS[corner];
  const scale = round(between(rng, spec.protagonista!.scale), 2);
  const size = scale * SHAPE_UNIT;
  const file = pick(rng, allShapeFiles);
  const sil = opts.silhouettes[file];
  let hero: Draft | null = null;
  for (let i = 0; i < 30 && !hero; i++) {
    // Centro fora do canvas, além do canto: só uma ponta invade a tela.
    const out = between(rng, [0.12, 0.42]) * size;
    const angle = between(rng, [0.15, 0.85]) * (Math.PI / 2);
    const d: Draft = {
      file,
      scale,
      x: Math.round(c.x + (c.x === 0 ? -1 : 1) * Math.cos(angle) * out),
      y: Math.round(c.y + (c.y === 0 ? -1 : 1) * Math.sin(angle) * out),
      rotation: Math.round(between(rng, [0, 360])),
      role: "protagonista",
    };
    const cov = canvasCoverage(sil, placed(d), CANVAS);
    if (cov >= BLEED_COVERAGE[0] && cov <= BLEED_COVERAGE[1] && fits(d, [], opts)) hero = d;
  }
  if (!hero) return null;

  const opposite = CORNERS[(corner + 2) % 4];
  const drafts: Draft[] = [hero];
  const count = intBetween(rng, spec.coadjuvantes!.count);
  for (let k = 0; k < count; k++) {
    const d = placeNear(rng, opts, drafts, spec.coadjuvantes!.scale, opposite, 170, "coadjuvante");
    if (!d) return null;
    drafts.push(d);
  }
  return drafts;
}

/** Sorteia um shape pequeno num quadrado de `reach` px a partir de um canto. */
function placeNear(
  rng: Rng,
  opts: GenerateOptions,
  accepted: Draft[],
  scaleRange: Range,
  corner: { x: number; y: number },
  reach: number,
  role: Draft["role"],
): Draft | null {
  for (let i = 0; i < 40; i++) {
    const d: Draft = {
      file: pick(rng, allShapeFiles),
      scale: round(between(rng, scaleRange), 2),
      x: Math.round(corner.x === 0 ? between(rng, [24, reach]) : CANVAS - between(rng, [24, reach])),
      y: Math.round(corner.y === 0 ? between(rng, [24, reach]) : CANVAS - between(rng, [24, reach])),
      rotation: Math.round(between(rng, [0, 360])),
      role,
    };
    if (fits(d, accepted, opts, 24)) return d;
  }
  return null;
}

// ---- Mosaico em dupla: 2 shapes médios, arestas paralelas, gap de 5%, ancorando título ou CTA ----

/** Regiões livres ao redor do título (acima, à direita) e do CTA (à direita). */
const MOSAIC_ANCHORS: { x: Range; y: Range }[] = [
  { x: [380, 540], y: [40, 130] },
  { x: [500, 570], y: [300, 470] },
];

function mosaicoDupla(rng: Rng, spec: ArchetypeSpec, opts: GenerateOptions): Draft[] | null {
  const zone = pick(rng, MOSAIC_ANCHORS);
  const [fileA, fileB] = [pick(rng, allShapeFiles), pick(rng, allShapeFiles)];
  const a: Draft = {
    file: fileA,
    scale: round(between(rng, spec.shapes!.scale), 2),
    x: Math.round(between(rng, zone.x)),
    y: Math.round(between(rng, zone.y)),
    rotation: Math.round(between(rng, [0, 360])),
    role: "protagonista",
  };
  if (!fits(a, [], opts)) return null;
  const scaleB = round(between(rng, [spec.shapes!.scale[0], Math.min(spec.shapes!.scale[1], a.scale)]), 2);
  const gap = (spec.gap ?? 0.05) * Math.max(a.scale, scaleB) * SHAPE_UNIT;
  const b = interlock(rng, opts, a, fileB, scaleB, gap);
  if (!b || !fits(b, [], opts)) return null;
  return [a, b];
}

/**
 * Encaixa B ao lado de A: para várias rotações e direções, desliza B até ficar a `gap` px de A e
 * escolhe a posição com mais borda "colada" (arestas paralelas).
 */
function interlock(rng: Rng, opts: GenerateOptions, a: Draft, fileB: string, scaleB: number, gap: number): Draft | null {
  const silA = opts.silhouettes[a.file];
  const silB = opts.silhouettes[fileB];
  const pa = placed(a);
  const edgeA = boundaryPoints(silA, pa, 140);
  const baseDir = between(rng, [0, 360]);
  let best: { d: Draft; contact: number } | null = null;
  for (let rot = 0; rot < 360; rot += 10) {
    for (let k = 0; k < 6; k++) {
      const dir = ((baseDir + k * 60) * Math.PI) / 180;
      const at = (dist: number): Draft => ({
        file: fileB,
        scale: scaleB,
        x: Math.round(a.x + Math.cos(dir) * dist),
        y: Math.round(a.y + Math.sin(dir) * dist),
        rotation: rot,
        role: "coadjuvante",
      });
      let lo = 0;
      let hi = (a.scale + scaleB) * SHAPE_UNIT;
      for (let it = 0; it < 12; it++) {
        const mid = (lo + hi) / 2;
        if (gapBetween(silA, pa, silB, placed(at(mid))) >= gap) hi = mid;
        else lo = mid;
      }
      const cand = at(hi);
      const edgeB = boundaryPoints(silB, placed(cand), 140);
      let contact = 0;
      for (let j = 0; j < edgeB.length; j += 2) {
        for (let i = 0; i < edgeA.length; i += 2) {
          if ((edgeA[i] - edgeB[j]) ** 2 + (edgeA[i + 1] - edgeB[j + 1]) ** 2 <= (gap + 4) ** 2) {
            contact++;
            break;
          }
        }
      }
      if (!best || contact > best.contact) best = { d: cand, contact };
    }
  }
  return best?.d ?? null;
}

// ---- Textura espalhada: 3-5 shapes minúsculos nas bordas ----

function texturaEspalhada(rng: Rng, spec: ArchetypeSpec, opts: GenerateOptions): Draft[] | null {
  const count = intBetween(rng, spec.shapes!.count);
  const drafts: Draft[] = [];
  for (let k = 0; k < count; k++) {
    let ok: Draft | null = null;
    for (let i = 0; i < 60 && !ok; i++) {
      // Faixa de 100px junto a uma das bordas.
      const edge = intBetween(rng, [0, 3]);
      const along = between(rng, [20, CANVAS - 20]);
      const depth = between(rng, [14, 100]);
      const pos = [
        { x: along, y: depth },
        { x: CANVAS - depth, y: along },
        { x: along, y: CANVAS - depth },
        { x: depth, y: along },
      ][edge];
      const d: Draft = {
        file: pick(rng, allShapeFiles),
        scale: round(between(rng, spec.shapes!.scale), 2),
        x: Math.round(pos.x),
        y: Math.round(pos.y),
        rotation: Math.round(between(rng, [0, 360])),
        role: "textura",
      };
      // Espalhados: longe uns dos outros, não amontoados.
      if (drafts.some((o) => Math.hypot(o.x - d.x, o.y - d.y) < 90)) continue;
      if (fits(d, drafts, opts)) ok = d;
    }
    if (!ok) return null;
    drafts.push(ok);
  }
  return drafts;
}

// ---- Cores (colorMix) ----

interface ColorSlot {
  color: ColorKey;
  mode: ColorMode;
  smallOnly: boolean;
}

function slot(name: string): ColorSlot {
  if (name.endsWith("-outline")) return { color: name.replace("-outline", "") as ColorKey, mode: "stroke", smallOnly: false };
  if (name.endsWith("-pequeno")) return { color: name.replace("-pequeno", "") as ColorKey, mode: "fill", smallOnly: true };
  return { color: name as ColorKey, mode: "fill", smallOnly: false };
}

/**
 * Sorteia uma combinação e distribui as cores: o maior shape pega uma cor "grande"; os demais
 * alternam entre as outras. Amarelo só vai para shapes com scale < 0.4.
 */
function assignColors(rng: Rng, drafts: Draft[]): { combo: string[]; shapes: GeneratedShape[] } | null {
  const maxAmarelo = amareloMaxScale();
  for (const combo of shuffle(rng, colorCombos)) {
    const slots = combo.map(slot);
    const big = slots.filter((s) => !s.smallOnly);
    if (big.length === 0) continue;
    const order = [...drafts].map((d, i) => ({ d, i })).sort((p, q) => q.d.scale - p.d.scale);
    const result: GeneratedShape[] = new Array(drafts.length);
    const used = new Set<string>();
    let ok = true;
    order.forEach(({ d, i }, rank) => {
      // Primeiro tenta uma cor ainda não usada, para o arranjo ter ao menos 2 cores.
      const candidates = slots.filter((s) => !s.smallOnly || (d.scale < maxAmarelo && rank > 0));
      if (candidates.length === 0) {
        ok = false;
        return;
      }
      const fresh = candidates.filter((s) => !used.has(`${s.color}-${s.mode}`));
      const s = rank === 0 ? pick(rng, big) : pick(rng, fresh.length ? fresh : candidates);
      used.add(`${s.color}-${s.mode}`);
      result[i] = { ...d, color: s.color, mode: s.mode };
    });
    if (!ok) continue;
    if (drafts.length > 1 && used.size < 2) continue;
    return { combo, shapes: result };
  }
  return null;
}
