"use client";

import { useMemo } from "react";
import { Group, Text as KText } from "react-konva";
import { color, fontStack, fontWeight } from "@/lib/brand-tokens";
import type { TextLayer } from "@/lib/alerta-spec";
import { layoutRichText, parseHighlights } from "@/lib/rich-text";

/** Bloco de texto com palavras-chave destacadas (padrão "palavra-chave-destacada"). */
export default function RichText({ layer }: { layer: TextLayer }) {
  const { pieces } = useMemo(
    () =>
      layoutRichText(
        parseHighlights(layer.text),
        { color: layer.color, weight: layer.weight },
        layer.highlight,
        layer.fontSize,
        layer.width,
      ),
    [layer],
  );
  const lineBox = layer.fontSize * layer.lineHeight;

  return (
    <Group name="brand-layer" id={layer.id}>
      {pieces.map((piece, i) => (
        <KText
          key={i}
          text={piece.text}
          x={layer.x + piece.x}
          y={layer.y + piece.line * lineBox}
          fontSize={layer.fontSize}
          lineHeight={layer.lineHeight}
          fontFamily={fontStack}
          fontStyle={String(fontWeight(piece.style.weight))}
          fill={color(piece.style.color)}
        />
      ))}
    </Group>
  );
}
