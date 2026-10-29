"use client";

import { useEffect } from "react";
import { Group, Image as KImage } from "react-konva";
import { color, shapePath } from "@/lib/brand-tokens";
import type { ShapeLayer } from "@/lib/alerta-spec";
import { useSvgAsset } from "@/lib/use-svg-asset";

interface ShapeDecorProps {
  layer: ShapeLayer;
  onReady?: () => void;
}

/** Shape decorativo. Só escala uniforme/rotação (shapes.forbiddenTransforms: distort-proportions). */
export default function ShapeDecor({ layer, onReady }: ShapeDecorProps) {
  const asset = useSvgAsset(shapePath(layer.file), { fill: color(layer.color) });

  useEffect(() => {
    if (asset) onReady?.();
  }, [asset, onReady]);

  if (!asset) return null;
  const height = (asset.height / asset.width) * layer.width;
  return (
    <Group name="brand-layer" id={layer.id}>
      <KImage
        image={asset.image}
        x={layer.x}
        y={layer.y}
        width={layer.width}
        height={height}
        rotation={layer.rotation ?? 0}
      />
    </Group>
  );
}
