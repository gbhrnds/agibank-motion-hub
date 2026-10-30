/**
 * Motor de geração dinâmica de layouts (config/composition-patterns.json).
 *
 * `generateRandomLayout()` sorteia o estado global da peça — alinhamento, estilo do CTA, arquétipo
 * de shapes e paleta de shapes permitida para o fundo — e calcula x, y, escala e rotação de cada
 * shape. Cada candidato é testado contra a silhueta real dos SVGs: nada cai sobre textos, CTA ou a
 * área de proteção do logo (que mudam de lugar com o alinhamento), e shapes não se sobrepõem.
 */

import type { Rect } from "./alerta-spec";
import { brandTokens, type ColorKey } from "./brand-tokens";
import {
  alignments,
  archetype,
  archetypeIds,
  ctaStyles,
  mosaicGap,
  shapePalettes,
  type Alignment,
  type ArchetypeId,
  type CtaStyle,
  type Range,
  type ShapePalette,
} from "./composition-tokens";
import { boundaryPoints, canvasCoverage, gapBetween, hitsRect, type PlacedShape, type Silhouette } from "./shape-silhouette";
import type { ColorMode } from "./svg-utils";

/** Maior dimensão de um shape com scale 1.0, em px. */
export const SHAPE_UNIT = 130;
const CANVAS = 600;
/** Folga mínima entre um shape e textos/CTA/área do logo. */
const KEEP_OUT_MARGIN = 10;
/** Amarelo é "apenas detalhe" (assets-map.json → brandRules.colorUsage): só em shapes pequenos. */
export const AMARELO_MAX_SCALE = 0.4;

/**
 * Hierarquia de tamanho por papel (dynamicShapeArrangements: "contraste brutal Gigante vs Média vs Micro").
 * As faixas detalham as descrições do JSON: protagonista do mosaico "scale 2.0+", médio "0.8",
 * pequenos "0.3", estouro "4.0+", textura "0.1 a 0.25".
 */
export const SCALE_BY_ROLE = {
  protagonista: [2.0, 3.5] as Range,
  medio: [0.7, 1.0] as Range,
  micro: [0.2, 0.4] as Range,
  estouro: [4.0, 6.0] as Range,
  textura: [0.1, 0.25] as Range,
};
/** Quanto do canvas a ponta de um shape que sangra pode cobrir. */
const BLEED_COVERAGE: Record<"protagonista" | "estouro", Range> = {
  protagonista: [0.05, 0.2],
  estouro: [0.06, 0.25],
};

export type ShapeRole = keyof typeof SCALE_BY_ROLE;

export interface GeneratedShape {
  file: string;
  color: ColorKey;
  mode: ColorMode;
  scale: number;
  x: number;
  y: number;
  rotation: number;
  role: ShapeRole;
}

/** Estado global de uma composição gerada. */
export interface PieceLayout {
  seed: number;
  alignment: Alignment;
  ctaStyle: CtaStyle;
  /** Cor do texto/borda do CTA nas variantes sem fundo sólido ("pill-outline", "text-only-arrow"). */
  ctaColor: ColorKey;
  shapeArchetype: ArchetypeId;
  shapePalette: ShapePalette;
  shapes: GeneratedShape[];
}

export interface KeepOutZone {
  label: string;
  rect: Rect;
}

export interface GenerateOptions {
  /** Cor do fundo da peça (escolhe as paletas em shapeColorsByBackground). */
  background: ColorKey;
  /** Silhueta de cada arquivo de shape (ver loadSilhouette). */
  silhouettes: Record<string, Silhouette>;
  /** Áreas que nenhum shape pode tocar para um alinhamento/CTA (textos, CTA, área de proteção do logo). */
  keepOutFor: (piece: Pick<PieceLayout, "alignment" | "ctaStyle" | "ctaColor">) => KeepOutZone[];
  seed?: number;
  /** Força escolhas (útil em testes). */
  archetype?: ArchetypeId;
  alignment?: Alignment;
  ctaStyle?: CtaStyle;
}

/** Cores possíveis para texto/borda do CTA sem fundo sólido (ctaRules "pill-outline": "branca ou verde"). */
export const CTA_LINE_COLORS: ColorKey[] = ["branco", "verde"];

export const allShapeFiles: string[] = Object.values(brandTokens.shapes.byType).flat();

/** PRNG determinístico (mulberry32): o mesmo seed gera a mesma composição. */
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
const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

function shuffle<T>(rng: Rng, list: T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function generateRandomLayout(options: GenerateOptions): PieceLayout {
  const seed = options.seed ?? Math.floor(Math.random() * 2 ** 31);
  const rng = seededRandom(seed);
  const palettes = shapePalettes(options.background);
  if (palettes.length === 0) throw new Error(`Sem paletas de shapes para o fundo "${options.background}".`);

  const alignment = options.alignment ?? pick(rng, alignments);
  const ctaStyle = options.ctaStyle ?? pick(rng, ctaStyles);
  const ctaColor = ctaStyle === "pill-solid-accent" ? "azulEscuro" : pick(rng, CTA_LINE_COLORS);
  const shapePalette = pick(rng, palettes);
  const keepOut = options.keepOutFor({ alignment, ctaStyle, ctaColor });

  const order = options.archetype ? [options.archetype] : shuffle(rng, archetypeIds);
  for (const id of order) {
    for (let attempt = 0; attempt < 40; attempt++) {
      const drafts = arrange(rng, id, options.silhouettes, keepOut);
      if (!drafts) continue;
      return { seed, alignment, ctaStyle, ctaColor, shapeArchetype: id, shapePalette, shapes: paint(rng, drafts, shapePalette) };
    }
  }
  throw new Error("Não foi possível gerar shapes que respeitem textos, CTA e logo.");
}

interface Draft {
  file: string;
  scale: number;
  x: number;
  y: number;
  rotation: number;
  role: ShapeRole;
}

const placed = (d: Draft): PlacedShape => ({ file: d.file, x: d.x, y: d.y, size: d.scale * SHAPE_UNIT, rotation: d.rotation });

interface Ctx {
  silhouettes: Record<string, Silhouette>;
  keepOut: KeepOutZone[];
}

/** Respeita textos/CTA/logo e fica a pelo menos `spacing` px dos shapes já aceitos? */
function fits(c: Ctx, d: Draft, accepted: Draft[], spacing: number): boolean {
  const sil = c.silhouettes[d.file];
  const p = placed(d);
  if (c.keepOut.some((z) => hitsRect(sil, p, z.rect, KEEP_OUT_MARGIN))) return false;
  return accepted.every((o) => gapBetween(c.silhouettes[o.file], placed(o), sil, p) >= spacing);
}

function arrange(rng: Rng, id: ArchetypeId, silhouettes: Record<string, Silhouette>, keepOut: KeepOutZone[]): Draft[] | null {
  const c: Ctx = { silhouettes, keepOut };
  if (id === "estouro-solitario") {
    const hero = bleeding(rng, c, SCALE_BY_ROLE.estouro, BLEED_COVERAGE.estouro, "estouro");
    return hero ? [hero] : null;
  }
  if (id === "mosaico-hierarquico") return mosaicoHierarquico(rng, c);
  return texturaEspalhada(rng, c);
}

const CORNERS = [
  { x: 0, y: 0 },
  { x: CANVAS, y: 0 },
  { x: CANVAS, y: CANVAS },
  { x: 0, y: CANVAS },
];

/** Shape grande com o centro fora do canvas, além de um canto: só uma borda invade a arte. */
function bleeding(rng: Rng, c: Ctx, scaleRange: Range, coverage: Range, role: ShapeRole): Draft | null {
  const corner = pick(rng, CORNERS);
  const scale = round(between(rng, scaleRange));
  const size = scale * SHAPE_UNIT;
  const file = pick(rng, allShapeFiles);
  for (let i = 0; i < 30; i++) {
    const out = between(rng, [0.12, 0.45]) * size;
    const angle = between(rng, [0.15, 0.85]) * (Math.PI / 2);
    const d: Draft = {
      file,
      scale,
      x: Math.round(corner.x + (corner.x === 0 ? -1 : 1) * Math.cos(angle) * out),
      y: Math.round(corner.y + (corner.y === 0 ? -1 : 1) * Math.sin(angle) * out),
      rotation: Math.round(between(rng, [0, 360])),
      role,
    };
    const cov = canvasCoverage(c.silhouettes[file], placed(d), CANVAS);
    if (cov >= coverage[0] && cov <= coverage[1] && fits(c, d, [], 0)) return d;
  }
  return null;
}

// ---- Mosaico com hierarquia: gigante sangrando + médio encaixado (gap ~5%) + 1-2 micros afastados ----

function mosaicoHierarquico(rng: Rng, c: Ctx): Draft[] | null {
  const hero = bleeding(rng, c, SCALE_BY_ROLE.protagonista, BLEED_COVERAGE.protagonista, "protagonista");
  if (!hero) return null;
  // Até 3 tentativas de médio (arquivo e escala) para o mesmo protagonista.
  let medio: Draft | null = null;
  for (let t = 0; t < 3 && !medio; t++) {
    const medioScale = round(between(rng, SCALE_BY_ROLE.medio));
    // Gap de ~5% do shape médio: medido na silhueta real, não só pela distância entre centros.
    const gap = Math.max(3, mosaicGap() * medioScale * SHAPE_UNIT);
    medio = interlock(rng, c, hero, pick(rng, allShapeFiles), medioScale, gap);
  }
  if (!medio) return null;

  const drafts = [hero, medio];
  const total = intBetween(rng, archetype("mosaico-hierarquico").count);
  const micros = Math.max(1, total - 2);
  for (let k = 0; k < micros; k++) {
    const m = nearEdge(rng, c, drafts, SCALE_BY_ROLE.micro, "micro", 60, [24, 140]);
    if (!m) return null;
    drafts.push(m);
  }
  return drafts;
}

/**
 * Encaixa o médio ao lado do protagonista: para várias rotações e direções (voltadas para dentro do
 * canvas), desliza até ficar a `gap` px da silhueta do protagonista e fica com a posição de mais
 * borda "colada" (arestas paralelas) que respeite textos, CTA e logo.
 */
function interlock(rng: Rng, c: Ctx, hero: Draft, file: string, scale: number, gap: number): Draft | null {
  const silA = c.silhouettes[hero.file];
  const silB = c.silhouettes[file];
  const pa = placed(hero);
  const edgeA = boundaryPoints(silA, pa, 160);
  const toCenter = Math.atan2(CANVAS / 2 - hero.y, CANVAS / 2 - hero.x);
  let best: { d: Draft; contact: number } | null = null;
  // Rotações relativas à do protagonista: assim os múltiplos de 15° incluem as arestas paralelas.
  const rotBase = hero.rotation + between(rng, [-4, 4]);
  for (let rot = rotBase; rot < 360 + rotBase; rot += 15) {
    for (const offset of [-60, -30, 0, 30, 60]) {
      const dir = toCenter + (offset * Math.PI) / 180;
      const at = (dist: number): Draft => ({
        file,
        scale,
        x: Math.round(hero.x + Math.cos(dir) * dist),
        y: Math.round(hero.y + Math.sin(dir) * dist),
        rotation: Math.round(((rot % 360) + 360) % 360),
        role: "medio",
      });
      let lo = 0;
      let hi = (hero.scale + scale) * SHAPE_UNIT;
      for (let it = 0; it < 12; it++) {
        const mid = (lo + hi) / 2;
        if (gapBetween(silA, pa, silB, placed(at(mid))) >= gap) hi = mid;
        else lo = mid;
      }
      const cand = at(hi);
      if (!inside(cand.x, cand.y, 30) || !fits(c, cand, [], 0)) continue;
      const edgeB = boundaryPoints(silB, placed(cand), 120);
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
  return best && best.contact >= 6 ? best.d : null;
}

const inside = (x: number, y: number, margin = 0) => x >= margin && y >= margin && x <= CANVAS - margin && y <= CANVAS - margin;

/**
 * Shape pequeno numa faixa junto às bordas laterais (x < 100 ou x > 500), a pelo menos
 * `spacing` px dos shapes aceitos.
 */
function nearEdge(
  rng: Rng,
  c: Ctx,
  accepted: Draft[],
  scaleRange: Range,
  role: ShapeRole,
  spacing: number,
  depth: Range,
): Draft | null {
  for (let i = 0; i < 60; i++) {
    const left = rng() < 0.5;
    const d: Draft = {
      file: pick(rng, allShapeFiles),
      scale: round(between(rng, scaleRange)),
      x: Math.round(left ? between(rng, depth) : CANVAS - between(rng, depth)),
      y: Math.round(between(rng, [24, CANVAS - 24])),
      rotation: Math.round(between(rng, [0, 360])),
      role,
    };
    if (fits(c, d, accepted, spacing)) return d;
  }
  return null;
}

// ---- Textura/faíscas: 4-6 shapes minúsculos nas laterais ----

function texturaEspalhada(rng: Rng, c: Ctx): Draft[] | null {
  const count = intBetween(rng, archetype("textura-espalhada").count);
  const drafts: Draft[] = [];
  for (let k = 0; k < count; k++) {
    const d = nearEdge(rng, c, drafts, SCALE_BY_ROLE.textura, "textura", 70, [14, 100]);
    if (!d) return null;
    drafts.push(d);
  }
  return drafts;
}

// ---- Cores: só as da paleta sorteada; amarelo só em shapes pequenos ----

function paint(rng: Rng, drafts: Draft[], palette: ShapePalette): GeneratedShape[] {
  const big = palette.colors.filter((col) => col !== "amarelo");
  const order = drafts.map((d, i) => ({ d, i })).sort((p, q) => q.d.scale - p.d.scale);
  const out: GeneratedShape[] = new Array(drafts.length);
  const used = new Set<ColorKey>();
  order.forEach(({ d, i }, rank) => {
    const allowed = d.scale < AMARELO_MAX_SCALE ? palette.colors : big;
    const options = allowed.length ? allowed : palette.colors;
    // O médio contrasta com o protagonista quando a paleta tem mais de uma cor.
    const fresh = options.filter((col) => !used.has(col));
    const col = rank > 0 && fresh.length ? pick(rng, fresh) : pick(rng, options);
    used.add(col);
    out[i] = { ...d, color: col, mode: "fill" };
  });
  return out;
}
