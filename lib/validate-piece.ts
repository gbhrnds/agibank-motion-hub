import { getBackground, getLogo, type Layer } from "./alerta-spec";
import { brandRules } from "./brand-tokens";
import type { CanvasLayout } from "./canvas-layout";
import {
  shapesHittingZone,
  validateCtaStyle,
  validateLineBreaks,
  validateShapeArrangement,
  validateTextHierarchy,
} from "./composition-validator";
import { validateColorUsage, validateContrast, type ValidationResult } from "./contrast-validator";
import { validateLogoClearSpace } from "./layout-validator";
import { validateLogoAudience } from "./logo-validator";
import { keepOutZones } from "./keep-out";
import type { GeneratedLayout } from "./layout-engine";
import { hasHighlight } from "./rich-text";

export interface ValidationItem {
  id: string;
  label: string;
  result: ValidationResult;
}

/** Roda todas as validações de marca da peça. `layout` é null enquanto o canvas não terminou de medir. */
export function validatePiece(
  layers: Layer[],
  channels: string[],
  layout: CanvasLayout | null,
  shapes: GeneratedLayout | null,
): ValidationItem[] {
  const items: ValidationItem[] = [];
  const background = getBackground(layers);

  items.push({
    id: "color-usage",
    label: "Uso de cor — fundo",
    result: validateColorUsage(layers, brandRules, layout?.colorCoverage),
  });

  if (background) {
    for (const layer of layers) {
      if (layer.type === "text") {
        items.push({
          id: `contrast-${layer.id}`,
          label: `Contraste — ${layer.label}`,
          // Títulos são destaque por natureza (padrão "titulo-bicolor").
          result: validateContrast(background.color, layer.color, brandRules, { destaque: layer.role === "titulo" }),
        });
        if (layer.highlight && hasHighlight(layer.text)) {
          items.push({
            id: `contrast-${layer.id}-destaque`,
            label: `Contraste — ${layer.label} (palavra-chave)`,
            result: validateContrast(background.color, layer.highlight.color, brandRules, { destaque: true }),
          });
        }
      } else if (layer.type === "cta") {
        // Texto do CTA é lido sobre a pílula quando ela existe.
        const surface = layer.pill?.color ?? background.color;
        items.push({
          id: `contrast-${layer.id}`,
          label: `Contraste — ${layer.label}${layer.pill ? " (sobre a pílula)" : ""}`,
          result: validateContrast(surface, layer.color, brandRules),
        });
      }
    }
  }

  items.push({ id: "text-hierarchy", label: "Hierarquia de cor no texto", result: validateTextHierarchy(layers) });
  items.push({ id: "cta-style", label: "CTA com destaque visual", result: validateCtaStyle(layers) });
  items.push({
    id: "logo-audience",
    label: "Logo — audiência",
    result: validateLogoAudience(getLogo(layers), channels),
  });

  if (layout) {
    items.push({
      id: "shape-arrangement",
      label: "Grafismo gerado",
      result: validateShapeArrangement(shapes, keepOutZones(layers, layout)),
    });
    items.push({
      id: "line-breaks",
      label: "Quebra de linha sem viúvas",
      result: validateLineBreaks(layers),
    });
    items.push({
      id: "logo-clear-space",
      label: "Área de proteção do logo",
      result: validateLogoClearSpace(
        layers,
        layout.bounds,
        layout.logoClearZone,
        shapesHittingZone(shapes, layout.logoClearZone),
      ),
    });
  }

  return items;
}
