"use client";

import { useEffect, useMemo } from "react";
import { Group, Image as KImage } from "react-konva";
import { CANVAS_SIZE, type ShapeClusterLayer } from "@/lib/alerta-spec";
import { color, shapePath } from "@/lib/brand-tokens";
import { analyzeCluster, buildMask, type ClusterReport } from "@/lib/cluster-geometry";
import { pieceSize, presetPieces } from "@/lib/shape-presets";
import { useSvgAssets } from "@/lib/use-svg-asset";

/** Espessura do contorno dos shapes em modo "stroke", em px da peça. */
const OUTLINE_PX = 2;

interface ShapeClusterProps {
  layer: ShapeClusterLayer;
  onReady?: (report: ClusterReport) => void;
}

/**
 * Padrão "mosaico-de-cacos": um Konva.Group posicionado no canto da peça com as peças do preset
 * nas posições fixas, cada uma recolorida via recolorSvg() e girada em torno do próprio centro.
 */
export default function ShapeCluster({ layer, onReady }: ShapeClusterProps) {
  const pieces = presetPieces(layer.preset);
  const groupScale = layer.scale ?? 1;
  const groupRotation = layer.rotation ?? 0;

  const requests = useMemo(
    () =>
      pieces.map((p) => ({
        src: shapePath(p.file),
        options: { recolor: { color: color(p.color), mode: p.mode, strokeWidth: OUTLINE_PX, targetSize: pieceSize(p) } },
      })),
    [pieces],
  );
  const assets = useSvgAssets(requests);

  const items = useMemo(() => {
    if (!assets) return null;
    return pieces.map((p, i) => {
      const a = assets[i];
      const s = pieceSize(p) / Math.max(a.width, a.height);
      return { image: a.image, width: a.width * s, height: a.height * s };
    });
  }, [assets, pieces]);

  // Só medição (para o painel): silhuetas nas posições finais, já com a transformação do grupo.
  useEffect(() => {
    if (!items) return;
    const rad = (groupRotation * Math.PI) / 180;
    const masks = items.map((it, i) =>
      buildMask({
        image: it.image,
        width: it.width * groupScale,
        height: it.height * groupScale,
        rotation: pieces[i].rotation + groupRotation,
        mirror: false,
      }),
    );
    const positions = pieces.map((p) => ({
      x: layer.x + (p.x * Math.cos(rad) - p.y * Math.sin(rad)) * groupScale,
      y: layer.y + (p.x * Math.sin(rad) + p.y * Math.cos(rad)) * groupScale,
    }));
    onReady?.(analyzeCluster(masks, positions, pieces.map((p) => pieceSize(p) * groupScale), CANVAS_SIZE));
  }, [items, pieces, layer.x, layer.y, groupRotation, groupScale, onReady]);

  if (!items) return null;
  return (
    <Group name="brand-layer" id={layer.id} x={layer.x} y={layer.y} rotation={groupRotation} scaleX={groupScale} scaleY={groupScale}>
      {items.map((item, i) => (
        <KImage
          key={`${pieces[i].file}-${i}`}
          name="cluster-item"
          id={`${layer.id}:${i}`}
          image={item.image}
          x={pieces[i].x}
          y={pieces[i].y}
          width={item.width}
          height={item.height}
          offsetX={item.width / 2}
          offsetY={item.height / 2}
          rotation={pieces[i].rotation}
        />
      ))}
    </Group>
  );
}
