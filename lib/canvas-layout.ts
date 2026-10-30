import type { Rect } from "./alerta-spec";
import type { ColorKey } from "./brand-tokens";
import type { ClusterReport } from "./cluster-geometry";

export const GUIDES_LAYER_NAME = "guides";

export interface CanvasLayout {
  /** Bbox renderizada de cada camada (exceto fundo), em px do canvas. */
  bounds: Record<string, Rect>;
  /** Retângulo do logo expandido pela área de proteção; null se não foi possível medir. */
  logoClearZone: Rect | null;
  /** Fração dos pixels da peça (0-1) mais próximos de cada cor da paleta. */
  colorCoverage: Partial<Record<ColorKey, number>>;
  /** Geometria medida de cada cluster (sobreposição, gaps, sangria), por id da camada. */
  clusters: Record<string, ClusterReport>;
}
