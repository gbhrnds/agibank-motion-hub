"use client";

import { useEffect, useMemo } from "react";
import { Group, Image as KImage } from "react-konva";
import { color, shapePath } from "@/lib/brand-tokens";
import { SHAPE_UNIT, type PieceLayout } from "@/lib/layout-engine";
import { useSvgAssets } from "@/lib/use-svg-asset";

/** Espessura do contorno dos shapes em modo "stroke", em px da peça. */
const OUTLINE_PX = 2;

interface ShapeClusterProps {
  id: string;
  layout: PieceLayout;
  onReady?: () => void;
}

/**
 * Desenha os grafismos de um layout gerado (lib/layout-engine.ts): cada shape recolorido via
 * recolorSvg() e posicionado pelo centro, com escala uniforme e rotação.
 */
export default function ShapeCluster({ id, layout, onReady }: ShapeClusterProps) {
  const requests = useMemo(
    () =>
      layout.shapes.map((s) => ({
        src: shapePath(s.file),
        options: {
          recolor: { color: color(s.color), mode: s.mode, strokeWidth: OUTLINE_PX, targetSize: s.scale * SHAPE_UNIT },
        },
      })),
    [layout],
  );
  const assets = useSvgAssets(requests);

  useEffect(() => {
    if (assets) onReady?.();
  }, [assets, onReady]);

  if (!assets) return null;
  return (
    <Group name="brand-layer" id={id}>
      {layout.shapes.map((s, i) => {
        const a = assets[i];
        const k = (s.scale * SHAPE_UNIT) / Math.max(a.width, a.height);
        const width = a.width * k;
        const height = a.height * k;
        return (
          <KImage
            key={`${s.file}-${i}`}
            name="shape-item"
            id={`${id}:${i}`}
            image={a.image}
            x={s.x}
            y={s.y}
            width={width}
            height={height}
            offsetX={width / 2}
            offsetY={height / 2}
            rotation={s.rotation}
          />
        );
      })}
    </Group>
  );
}
