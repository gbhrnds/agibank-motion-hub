"use client";

import { Group, Rect as KRect, Text as KText } from "react-konva";
import { color, effect, fontStack, fontWeight } from "@/lib/brand-tokens";
import type { CtaLayer } from "@/lib/piece-spec";
import type { CtaGeometry } from "@/lib/cta-geometry";
import IconInline from "./IconInline";

interface CtaPillProps {
  layer: CtaLayer;
  geometry: CtaGeometry;
  onIconReady?: () => void;
}

/**
 * CTA nas variantes de composition-patterns.json → ctaRules: pílula sólida (com sombra opcional,
 * assets-map.json → effects), pílula outline (só borda) ou texto com seta (sem caixa).
 * Cantos totalmente arredondados; o ícone acompanha a cor do texto.
 */
export default function CtaPill({ layer, geometry, onIconReady }: CtaPillProps) {
  const { box } = geometry;
  const shadow = layer.pill?.shadow ? effect(layer.pill.shadow) : null;
  return (
    <Group name="brand-layer" id={layer.id}>
      {layer.pill && (
        <KRect
          {...box}
          fill={layer.pill.fill ? color(layer.pill.fill) : undefined}
          stroke={layer.pill.stroke ? color(layer.pill.stroke) : undefined}
          strokeWidth={layer.pill.stroke ? (layer.pill.strokeWidth ?? 2) : 0}
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
