"use client";

import { useEffect, useMemo, useState } from "react";
import { Group, Image as KImage } from "react-konva";
import { color, shapePath } from "@/lib/brand-tokens";
import type { ClusterShape, ShapeClusterLayer } from "@/lib/alerta-spec";
import { useSvgAsset } from "@/lib/use-svg-asset";

/** Espessura do contorno dos shapes em modo "stroke", em px da peça. */
const OUTLINE_PX = 2;

interface ShapeClusterProps {
  layer: ShapeClusterLayer;
  onReady?: () => void;
}

/**
 * Padrão "montagem-de-cacos" (composition-patterns.json → shapeClusterPattern): 3 a 6 shapes
 * recoloridos via recolorSvg(), girados/espelhados/escalados em torno do próprio centro e
 * desenhados por zIndex. Sobreposição entre shapes do mesmo cluster é permitida (transformRules.overlapAllowed).
 */
export default function ShapeCluster({ layer, onReady }: ShapeClusterProps) {
  const ordered = useMemo(
    () => layer.shapes.map((shape, index) => ({ shape, index })).sort((a, b) => a.shape.zIndex - b.shape.zIndex),
    [layer.shapes],
  );
  const [loaded, setLoaded] = useState<Record<number, true>>({});

  useEffect(() => {
    setLoaded({});
  }, [layer.shapes]);
  useEffect(() => {
    if (Object.keys(loaded).length === layer.shapes.length) onReady?.();
  }, [loaded, layer.shapes.length, onReady]);

  return (
    <Group name="brand-layer" id={layer.id}>
      {ordered.map(({ shape, index }) => (
        <ClusterItem
          key={`${shape.file}-${index}`}
          id={`${layer.id}:${index}`}
          shape={shape}
          onReady={() => setLoaded((prev) => (prev[index] ? prev : { ...prev, [index]: true }))}
        />
      ))}
    </Group>
  );
}

function ClusterItem({ id, shape, onReady }: { id: string; shape: ClusterShape; onReady: () => void }) {
  const asset = useSvgAsset(shapePath(shape.file), {
    recolor: { color: color(shape.color), mode: shape.mode, strokeWidth: OUTLINE_PX, targetSize: shape.size },
  });

  useEffect(() => {
    if (asset) onReady();
    // onReady muda a cada render do pai; só interessa a transição para "carregado".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset]);

  if (!asset) return null;
  const scale = shape.size / Math.max(asset.width, asset.height);
  const width = asset.width * scale;
  const height = asset.height * scale;
  return (
    <KImage
      name="cluster-item"
      id={id}
      image={asset.image}
      x={shape.x}
      y={shape.y}
      width={width}
      height={height}
      offsetX={width / 2}
      offsetY={height / 2}
      rotation={shape.rotation ?? 0}
      scaleX={shape.mirror ? -1 : 1}
    />
  );
}
