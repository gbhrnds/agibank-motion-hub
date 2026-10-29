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

export const shapePatternNames: string[] = compositionPatterns.shapeUsageRules.patterns.map((p) => p.name);
