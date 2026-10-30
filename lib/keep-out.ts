import { logoPosition, type Layer, type Rect, type Size } from "./piece-spec";
import type { CanvasLayout } from "./canvas-layout";
import { ctaGeometry } from "./cta-geometry";
import type { KeepOutZone } from "./layout-engine";
import { composeLayers, type PieceStyle } from "./piece-style";
import { breakText } from "./rich-text";

/** Áreas medidas no canvas que os grafismos não podem tocar: textos, CTA e área de proteção do logo. */
export function keepOutZones(layers: Layer[], layout: CanvasLayout): KeepOutZone[] {
  const zones: KeepOutZone[] = layers
    .filter((l) => (l.type === "text" || l.type === "cta") && layout.bounds[l.id])
    .map((l) => ({ label: l.label, rect: layout.bounds[l.id] }));
  if (layout.logoClearZone) zones.push({ label: "Área de proteção do logo", rect: layout.logoClearZone });
  return zones;
}

/** Tamanho do logo e da área de proteção, medidos uma vez (não dependem do alinhamento). */
export interface LogoMetrics {
  width: number;
  height: number;
  clearSpace: number;
}

export function logoMetricsFrom(layers: Layer[], layout: CanvasLayout): LogoMetrics | null {
  const logo = layers.find((l) => l.type === "logo");
  const rect = logo && layout.bounds[logo.id];
  if (!rect || !layout.logoClearZone) return null;
  return { width: rect.width, height: rect.height, clearSpace: rect.x - layout.logoClearZone.x };
}

/**
 * Prevê as mesmas áreas para um alinhamento/CTA ainda não renderizado (o motor escolhe o
 * alinhamento e os shapes juntos). Usa a mesma composição, quebra de linha e geometria de CTA do canvas.
 */
export function predictKeepOut(layers: Layer[], size: Size, logo: LogoMetrics, piece: PieceStyle): KeepOutZone[] {
  const zones: KeepOutZone[] = [];
  for (const l of composeLayers(layers, size, piece, logo)) {
    if (l.type === "text") {
      const lines = breakText(l.text, l, l.highlight, l.fontSize, l.width).split("\n").length;
      zones.push({ label: l.label, rect: { x: l.x, y: l.y, width: l.width, height: lines * l.fontSize * l.lineHeight } });
    } else if (l.type === "cta") {
      zones.push({ label: l.label, rect: ctaGeometry(l, size.width).box });
    } else if (l.type === "logo") {
      const { x, y } = logoPosition(l, size, logo.height);
      const r: Rect = { x: x - logo.clearSpace, y: y - logo.clearSpace, width: logo.width + logo.clearSpace * 2, height: logo.height + logo.clearSpace * 2 };
      zones.push({ label: "Área de proteção do logo", rect: r });
    }
  }
  return zones;
}
