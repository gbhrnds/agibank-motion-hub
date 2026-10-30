import type { Layer } from "./alerta-spec";
import type { CanvasLayout } from "./canvas-layout";
import type { KeepOutZone } from "./layout-engine";

/** Áreas que os grafismos não podem tocar: textos, CTA e a área de proteção do logo (medidos no canvas). */
export function keepOutZones(layers: Layer[], layout: CanvasLayout): KeepOutZone[] {
  const zones: KeepOutZone[] = layers
    .filter((l) => (l.type === "text" || l.type === "cta") && layout.bounds[l.id])
    .map((l) => ({ label: l.label, rect: layout.bounds[l.id] }));
  if (layout.logoClearZone) zones.push({ label: "Área de proteção do logo", rect: layout.logoClearZone });
  return zones;
}
