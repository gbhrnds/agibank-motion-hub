import compositionPatterns from "@/config/composition-patterns.json";
import type { FontWeightKey } from "./brand-tokens";

/** Camada tipada sobre config/composition-patterns.json (padrões de peças aprovadas). */

export const composition = compositionPatterns;

export type ScaleRole = keyof typeof compositionPatterns.typographyScale;

export interface TypographyRange {
  min: number;
  max: number;
  weights: FontWeightKey[];
}

/** Lê typographyScale.<papel> ("32-48px" → { min: 32, max: 48 }). */
export function typographyRange(role: ScaleRole): TypographyRange {
  const scale = compositionPatterns.typographyScale[role];
  const [min, max] = scale.sizeRange.replace("px", "").split("-").map(Number);
  return { min, max, weights: scale.weight as FontWeightKey[] };
}

/** "3 a 6 shapes" em shapeClusterPattern.description. */
export function clusterSizeRange(): { min: number; max: number } {
  const m = compositionPatterns.shapeClusterPattern.description.match(/(\d+)\s*a\s*(\d+)\s*shapes/);
  return m ? { min: Number(m[1]), max: Number(m[2]) } : { min: 3, max: 6 };
}

export const clusterZones: string[] = compositionPatterns.shapeClusterPattern.positioning.map((p) => p.zone);
export const clusterColorCombos: string[][] = compositionPatterns.shapeClusterPattern.colorMix.allowedCombos;

export function ctaVariant(name: string) {
  return compositionPatterns.ctaRules.variants.find((v) => v.name === name);
}
