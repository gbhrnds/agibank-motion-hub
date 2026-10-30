"use client";

import { Group, Rect as KRect, Text as KText } from "react-konva";
import { color, effect, fontStack, fontWeight } from "@/lib/brand-tokens";
import type { CtaLayer } from "@/lib/alerta-spec";
import type { CtaGeometry } from "@/lib/cta-geometry";
import IconInline from "./IconInline";

interface CtaPillProps {
  layer: CtaLayer;
  geometry: CtaGeometry;
  onIconReady?: () => void;
}

/**
 * CTA como pílula sólida (composition-patterns.json → ctaRules), cantos totalmente arredondados,
 * sombra opcional (assets-map.json → effects) e ícone recolorido com a cor do texto.
 */
export default function CtaPill({ layer, geometry, onIconReady }: CtaPillProps) {
  const { box } = geometry;
  const shadow = layer.pill?.shadow ? effect(layer.pill.shadow) : null;
  return (
    <Group name="brand-layer" id={layer.id}>
      {layer.pill && (
        <KRect
          {...box}
          fill={color(layer.pill.color)}
          cornerRadius={box.height / 2}
          {...(shadow
            ? {
                shadowColor: shadow.color,
                shadowBlur: shadow.blur,
                shadowOpacity: shadow.opacity,
                shadowOffsetY: shadow.offsetY,
              }
            : {})}
        />
      )}
      <KText
        text={layer.text}
        x={geometry.textX}
        y={geometry.textY}
        fontSize={layer.fontSize}
        lineHeight={layer.lineHeight}
        fontFamily={fontStack}
        fontStyle={String(fontWeight(layer.weight))}
        fill={color(layer.color)}
      />
      {layer.trailingIcon && (
        <IconInline
          file={layer.trailingIcon.file}
          color={layer.color}
          size={layer.trailingIcon.size}
          x={geometry.iconX}
          y={geometry.iconY}
          onReady={onIconReady}
        />
      )}
    </Group>
  );
}
