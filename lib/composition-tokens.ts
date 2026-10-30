import compositionPatterns from "@/config/composition-patterns.json";

/** Camada tipada sobre config/composition-patterns.json (padrões de peças aprovadas). */

export const composition = compositionPatterns;

const cluster = compositionPatterns.shapeClusterPattern;

/** "3 a 5 shapes" em shapeClusterPattern.description. */
export function clusterSizeRange(): { min: number; max: number } {
  const m = cluster.description.match(/(\d+)\s*a\s*(\d+)\s*shapes/);
  return m ? { min: Number(m[1]), max: Number(m[2]) } : { min: 3, max: 5 };
}

export const clusterPresetIds: string[] = cluster.hardcodedPresets.map((p) => p.id);

export const ctaVariantNames: string[] = compositionPatterns.ctaRules.variants.map((v) => v.name);
