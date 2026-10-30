import type { Layer, Rect } from "./piece-spec";
import type { ValidationResult } from "./contrast-validator";

function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/**
 * Nenhum shape ou texto pode invadir a área de proteção do logo (logos.clearSpace).
 * Usa as bboxes medidas no Stage do Konva.
 */
export function validateLogoClearSpace(
  layers: Layer[],
  bounds: Record<string, Rect>,
  clearZone: Rect | null,
  /** Grafismos que invadem a área, medidos pela silhueta (a bbox de um shape gigante não serve). */
  shapesInside: string[] = [],
): ValidationResult {
  if (!clearZone) {
    return {
      valid: false,
      severity: "blocking",
      message: "Não foi possível medir a área de proteção do logo (referência não encontrada no SVG).",
    };
  }
  const invasores = layers
    .filter(
      (l) =>
        l.type !== "background" && l.type !== "logo" && l.type !== "shapes" && bounds[l.id] && intersects(bounds[l.id], clearZone),
    )
    .map((l) => l.label)
    .concat(shapesInside);
  if (invasores.length > 0) {
    return {
      valid: false,
      severity: "blocking",
      message: `Invadem a área de proteção do logo: ${invasores.join(", ")}.`,
    };
  }
  return {
    valid: true,
    severity: "ok",
    message: "Nenhum shape ou texto dentro da área de proteção do logo.",
  };
}
