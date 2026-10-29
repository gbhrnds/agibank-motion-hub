import type { Rect } from "./alerta-spec";

export const GUIDES_LAYER_NAME = "guides";

export interface CanvasLayout {
  /** Bbox renderizada de cada camada (exceto fundo), em px do canvas. */
  bounds: Record<string, Rect>;
  /** Retângulo do logo expandido pela área de proteção; null se não foi possível medir. */
  logoClearZone: Rect | null;
}
