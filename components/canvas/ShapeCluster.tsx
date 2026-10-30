"use client";

import { useEffect, useMemo } from "react";
import { Group, Image as KImage } from "react-konva";
import { CANVAS_SIZE, type ShapeClusterLayer } from "@/lib/alerta-spec";
import { color, shapePath } from "@/lib/brand-tokens";
import { analyzeCluster, buildMask, solveCluster, type ClusterReport } from "@/lib/cluster-geometry";
import { useSvgAssets } from "@/lib/use-svg-asset";

/** Espessura do contorno dos shapes em modo "stroke", em px da peça. */
const OUTLINE_PX = 2;

interface ShapeClusterProps {
  layer: ShapeClusterLayer;
  onReady?: (report: ClusterReport) => void;
}

/**
 * Padrão "mosaico-de-cacos" (composition-patterns.json → shapeClusterPattern, arrangement
 * "mosaic-adjacent"): shapes recoloridos via recolorSvg(), girados/espelhados/escalados em torno
 * do próprio centro e posicionados LADO A LADO — cada coadjuvante é encaixado no vizinho a partir
 * da silhueta real (máscara de pixels), com gap de 0-6% e sem nenhuma sobreposição de área.
 */
export default function ShapeCluster({ layer, onReady }: ShapeClusterProps) {
  const requests = useMemo(
    () =>
      layer.shapes.map((s) => ({
        src: shapePath(s.file),
        options: { recolor: { color: color(s.color), mode: s.mode, strokeWidth: OUTLINE_PX, targetSize: s.size } },
      })),
    [layer.shapes],
  );
  const assets = useSvgAssets(requests);

  const resolved = useMemo(() => {
    if (!assets) return null;
    const items = layer.shapes.map((s, i) => {
      const a = assets[i];
      const scale = s.size / Math.max(a.width, a.height);
      return { image: a.image, width: a.width * scale, height: a.height * scale, rotation: s.rotation ?? 0, mirror: !!s.mirror };
    });
    const masks = items.map(buildMask);
    const sizes = layer.shapes.map((s) => s.size);
    const positions = solveCluster(masks, layer.shapes.map((s) => s.placement), Math.max(...sizes));
    return { items, positions, report: analyzeCluster(masks, positions, sizes, CANVAS_SIZE) };
  }, [assets, layer.shapes]);

  useEffect(() => {
    if (resolved) onReady?.(resolved.report);
  }, [resolved, onReady]);

  if (!resolved) return null;
  return (
    <Group name="brand-layer" id={layer.id}>
      {resolved.items.map((item, i) => (
        <KImage
          key={`${layer.shapes[i].file}-${i}`}
          name="cluster-item"
          id={`${layer.id}:${i}`}
          image={item.image}
          x={resolved.positions[i].x}
          y={resolved.positions[i].y}
          width={item.width}
          height={item.height}
          offsetX={item.width / 2}
          offsetY={item.height / 2}
          rotation={item.rotation}
          scaleX={item.mirror ? -1 : 1}
        />
      ))}
    </Group>
  );
}
