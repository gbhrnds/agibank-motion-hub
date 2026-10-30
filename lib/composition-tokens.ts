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

const cluster = compositionPatterns.shapeClusterPattern;

/** Mínimo de "3 a N shapes" (description) e máximo de maxShapesPerCluster. */
export function clusterSizeRange(): { min: number; max: number } {
  const m = cluster.description.match(/(\d+)\s*a\s*(\d+)\s*shapes/);
  return { min: m ? Number(m[1]) : 3, max: cluster.maxShapesPerCluster };
}

/** transformRules.gapRule, em % do maior shape. */
export const clusterGapRule: { min: number; max: number } = cluster.transformRules.gapRule;
export const clusterOverlapAllowed: boolean = cluster.transformRules.overlapAllowed;

/** "~40-60% do tamanho do protagonista" em scaleHierarchy.rule → { min: 0.4, max: 0.6 }. */
export function supportingScaleRange(): { min: number; max: number } {
  const m = cluster.scaleHierarchy.rule.match(/(\d+)\s*-\s*(\d+)%/);
  return m ? { min: Number(m[1]) / 100, max: Number(m[2]) / 100 } : { min: 0.4, max: 0.6 };
}

export const clusterZones: string[] = compositionPatterns.shapeClusterPattern.positioning.map((p) => p.zone);
export const clusterColorCombos: string[][] = compositionPatterns.shapeClusterPattern.colorMix.allowedCombos;

export function ctaVariant(name: string) {
  return compositionPatterns.ctaRules.variants.find((v) => v.name === name);
}
