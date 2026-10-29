"use client";

import { Group, Rect as KRect, Text as KText } from "react-konva";
import { color, fontStack, fontWeight } from "@/lib/brand-tokens";
import type { CtaLayer } from "@/lib/alerta-spec";
import type { CtaGeometry } from "@/lib/cta-geometry";
import IconInline from "./IconInline";

interface CtaPillProps {
  layer: CtaLayer;
  geometry: CtaGeometry;
  onIconReady?: () => void;
}

/** CTA como pílula sólida (composition-patterns.json → ctaRules "pill-solid-dark"), cantos totalmente arredondados. */
export default function CtaPill({ layer, geometry, onIconReady }: CtaPillProps) {
  const { box } = geometry;
  return (
    <Group name="brand-layer" id={layer.id}>
      {layer.pill && <KRect {...box} fill={color(layer.pill.color)} cornerRadius={box.height / 2} />}
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
