import compositionPatterns from "@/config/composition-patterns.json";
import type { ColorKey } from "./brand-tokens";

/** Camada tipada sobre config/composition-patterns.json (arquétipos visuais, CTAs, alinhamentos, paletas). */

export const composition = compositionPatterns;

export type Alignment = "left" | "center";
export type CtaStyle = "pill-solid-accent" | "pill-outline" | "text-only-arrow";
export type ArchetypeId = "mosaico-hierarquico" | "estouro-solitario" | "textura-espalhada";

export const alignments = compositionPatterns.textAndLayoutRules.alignments as Alignment[];
export const ctaStyles = compositionPatterns.ctaRules.variants.map((v) => v.id as CtaStyle);
export const archetypeIds = compositionPatterns.dynamicShapeArrangements.archetypes.map((a) => a.id as ArchetypeId);

export function ctaVariant(id: CtaStyle) {
  const v = compositionPatterns.ctaRules.variants.find((x) => x.id === id);
  if (!v) throw new Error(`Variante de CTA "${id}" não existe em ctaRules.variants`);
  return v;
}

export type Range = [number, number];

/** Nome e contagem de shapes do arquétipo (composition.count: número ou [min, max]). */
export function archetype(id: ArchetypeId): { id: ArchetypeId; name: string; count: Range } {
  const a = compositionPatterns.dynamicShapeArrangements.archetypes.find((x) => x.id === id);
  if (!a) throw new Error(`Arquétipo "${id}" não existe em dynamicShapeArrangements.archetypes`);
  const c = a.composition.count as number | number[];
  return { id, name: a.name, count: Array.isArray(c) ? [c[0], c[c.length - 1]] : [c, c] };
}

/** "aproximadamente 5%" em dynamicShapeArrangements.gapRule → 0.05. */
export function mosaicGap(): number {
  const m = compositionPatterns.dynamicShapeArrangements.gapRule.match(/(\d+(?:[.,]\d+)?)\s*%/);
  return m ? parseFloat(m[1].replace(",", ".")) / 100 : 0.05;
}

export interface ShapePalette {
  name: string;
  colors: ColorKey[];
}

/** Paletas de shapes permitidas para um fundo (shapeColorsByBackground). */
export function shapePalettes(background: ColorKey): ShapePalette[] {
  const table = compositionPatterns.shapeColorsByBackground as unknown as Record<string, ShapePalette[] | string>;
  const list = table[background];
  return Array.isArray(list) ? list : [];
}
