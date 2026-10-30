import type { ColorKey, ShapeFile } from "./brand-tokens";
import type { ColorMode } from "./svg-utils";

export interface PresetPiece {
  file: ShapeFile;
  color: ColorKey;
  mode: ColorMode;
  /** Escala relativa à unidade do preset (maior dimensão = PRESET_UNIT × scale). */
  scale: number;
  /** Centro da peça relativo à origem do grupo, em px (com o grupo em escala 1). */
  x: number;
  y: number;
  rotation: number;
}

/** Maior dimensão da peça com scale 1.0, em px. */
const PRESET_UNIT = 130;

/**
 * Presets de mosaico com posições FIXAS (composition-patterns.json → shapeClusterPattern.hardcodedPresets).
 * Valores ajustados sobre a silhueta real de cada SVG (medindo os vãos) para encaixar como quebra-cabeça:
 * gap de ~4px entre peças vizinhas, bordas vizinhas paralelas e nenhuma área sobreposta.
 * A validação do painel mede o resultado (sobreposição e gaps) — nada é recalculado aqui.
 */
export const SHAPE_PRESETS: Record<string, PresetPiece[]> = {
  "mosaic-preset-01": [
    // Protagonista: pentágono verde (origem do grupo).
    { file: "pentagon-01.svg", color: "verde", mode: "fill", scale: 1.0, x: 0, y: 0, rotation: 0 },
    // Coadjuvante 1: triângulo apontando para baixo, encostado na borda inferior esquerda do verde.
    { file: "triangle-04.svg", color: "azulEscuro", mode: "fill", scale: 0.7, x: -48, y: 66, rotation: 12 },
    // Coadjuvante 2: quadrilátero branco, encostado na borda inferior direita do verde.
    { file: "quadrilateral-10.svg", color: "branco", mode: "fill", scale: 0.7, x: 43, y: 75, rotation: 48 },
    // Detalhe: triângulo amarelo minúsculo na borda externa esquerda do azul.
    { file: "triangle-01.svg", color: "amarelo", mode: "fill", scale: 0.3, x: -81, y: 54, rotation: -148 },
  ],
};

export function presetPieces(id: string): PresetPiece[] {
  const pieces = SHAPE_PRESETS[id];
  if (!pieces) throw new Error(`Preset de mosaico "${id}" não existe em lib/shape-presets.ts`);
  return pieces;
}

export const pieceSize = (p: PresetPiece) => PRESET_UNIT * p.scale;
