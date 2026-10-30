import { CANVAS_SIZE, type CtaLayer, type Rect } from "./alerta-spec";
import { measureText } from "./rich-text";

export interface CtaGeometry {
  box: Rect;
  textX: number;
  textY: number;
  iconX: number;
  iconY: number;
}

/** Caixa do CTA (padding + texto + ícone), a partir do texto medido com a fonte de marca; sem pílula, só texto + ícone. */
export function ctaGeometry(layer: CtaLayer): CtaGeometry {
  const textWidth = measureText(layer.text, layer, layer.fontSize);
  const lineBox = layer.fontSize * layer.lineHeight;
  const padX = layer.pill?.paddingX ?? 0;
  const padY = layer.pill?.paddingY ?? 0;
  const icon = layer.trailingIcon;
  const contentWidth = textWidth + (icon ? icon.gap + icon.size : 0);
  const contentHeight = Math.max(lineBox, icon?.size ?? 0);
  const width = contentWidth + padX * 2;
  // Centralizado: acompanha o texto centralizado (textAndLayoutRules).
  const x = layer.align === "center" ? Math.round((CANVAS_SIZE - width) / 2) : layer.x;
  const textX = x + padX;
  const textY = layer.y + padY + (contentHeight - lineBox) / 2;
  return {
    box: { x, y: layer.y, width, height: contentHeight + padY * 2 },
    textX,
    textY,
    iconX: textX + textWidth + (icon?.gap ?? 0),
    iconY: layer.y + padY + (contentHeight - (icon?.size ?? 0)) / 2,
  };
}
