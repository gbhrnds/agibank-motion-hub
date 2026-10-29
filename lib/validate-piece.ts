import type { CanvasLayout } from "./canvas-layout";
import { getBackground, type Layer } from "./alerta-spec";
import { brandRules } from "./brand-tokens";
import { validateColorUsage, validateContrast, type ValidationResult } from "./contrast-validator";
import { validateLogoClearSpace } from "./layout-validator";

export interface ValidationItem {
  id: string;
  label: string;
  result: ValidationResult;
}

/** Roda todas as validações de marca da peça. `layout` é null enquanto o canvas não terminou de medir. */
export function validatePiece(layers: Layer[], layout: CanvasLayout | null): ValidationItem[] {
  const items: ValidationItem[] = [];
  const background = getBackground(layers);

  items.push({
    id: "color-usage",
    label: "Uso de cor — fundo",
    result: validateColorUsage(layers, brandRules),
  });

  if (background) {
    for (const layer of layers) {
      if (layer.type !== "text") continue;
      items.push({
        id: `contrast-${layer.id}`,
        label: `Contraste — ${layer.label}`,
        result: validateContrast(background.color, layer.color, brandRules),
      });
    }
  }

  if (layout) {
    items.push({
      id: "logo-clear-space",
      label: "Área de proteção do logo",
      result: validateLogoClearSpace(layers, layout.bounds, layout.logoClearZone),
    });
  }

  return items;
}
