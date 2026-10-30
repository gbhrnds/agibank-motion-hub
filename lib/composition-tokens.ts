import compositionPatterns from "@/config/composition-patterns.json";

/** Camada tipada sobre config/composition-patterns.json (arquétipos visuais e regras de composição). */

export const composition = compositionPatterns;

export type ArchetypeId = "estouro-de-canto" | "mosaico-dupla" | "textura-espalhada" | "mascara-de-foto";

export type Range = [number, number];

export interface ArchetypeSpec {
  id: ArchetypeId;
  name: string;
  /** Contagens/escalas normalizadas: um número vira [n, n]. */
  protagonista?: { count: Range; scale: Range };
  coadjuvantes?: { count: Range; scale: Range };
  shapes?: { count: Range; scale: Range };
  /** "5%" → 0.05 */
  gap?: number;
  overlap: boolean;
  isMask: boolean;
}

const range = (v: number | number[]): Range => (Array.isArray(v) ? [v[0], v[v.length - 1]] : [v, v]);

type RawComposition = {
  count?: number | number[];
  scaleRange?: number[];
  gap?: string;
  overlap?: boolean;
  isMask?: boolean;
  protagonista?: { count: number | number[]; scaleRange: number[] };
  coadjuvantes?: { count: number | number[]; scaleRange: number[]; overlap?: boolean };
};

export function archetype(id: ArchetypeId): ArchetypeSpec {
  const raw = compositionPatterns.dynamicShapeArrangements.archetypes.find((a) => a.id === id);
  if (!raw) throw new Error(`Arquétipo "${id}" não existe em dynamicShapeArrangements.archetypes`);
  const c = raw.composition as RawComposition;
  return {
    id,
    name: raw.name,
    protagonista: c.protagonista && { count: range(c.protagonista.count), scale: range(c.protagonista.scaleRange) },
    coadjuvantes: c.coadjuvantes && { count: range(c.coadjuvantes.count), scale: range(c.coadjuvantes.scaleRange) },
    shapes: c.count !== undefined && c.scaleRange ? { count: range(c.count), scale: range(c.scaleRange) } : undefined,
    gap: c.gap ? parseFloat(c.gap) / 100 : undefined,
    overlap: c.overlap ?? c.coadjuvantes?.overlap ?? false,
    isMask: !!c.isMask,
  };
}

export const archetypeIds = compositionPatterns.dynamicShapeArrangements.archetypes.map((a) => a.id as ArchetypeId);

/** Combinações de colorMix: "branco-outline" → branco em contorno; "amarelo-pequeno" → amarelo só em shape pequeno. */
export const colorCombos: string[][] = compositionPatterns.dynamicShapeArrangements.colorMix.allowedCombos;

/** "Amarelo apenas em shapes com scale < 0.4." */
export function amareloMaxScale(): number {
  const m = compositionPatterns.dynamicShapeArrangements.colorMix.rule.match(/scale\s*<\s*([\d.]+)/);
  return m ? Number(m[1]) : 0.4;
}

export const ctaVariantNames: string[] = compositionPatterns.ctaRules.variants.map((v) => v.name);
