"use client";

import { useEffect, useMemo, useState } from "react";
import { Group, Image as KImage } from "react-konva";
import { coverFit, maskPolygon, type ImageMask } from "@/lib/image-mask";
import type { ImageLayer } from "@/lib/piece-spec";

interface MaskedImageProps {
  layer: ImageLayer;
  mask: ImageMask;
  onReady?: () => void;
}

/** Imagem enviada recortada (clipFunc) por um polígono irregular que ocupa metade da peça. */
export default function MaskedImage({ layer, mask, onReady }: MaskedImageProps) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    let alive = true;
    setImage(null);
    const img = new window.Image();
    img.onload = () => alive && setImage(img);
    img.onerror = () => console.warn("Não foi possível abrir a imagem enviada.");
    img.src = layer.src;
    return () => {
      alive = false;
    };
  }, [layer.src]);

  useEffect(() => {
    if (image) onReady?.();
  }, [image, onReady]);

  const points = useMemo(() => maskPolygon(mask, layer.region, layer.placement), [mask, layer.region, layer.placement]);
  if (!image) return null;

  // A imagem cobre a caixa do polígono (que sangra para fora da peça).
  const xs = points.filter((_, i) => i % 2 === 0);
  const ys = points.filter((_, i) => i % 2 === 1);
  const box = { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
  const fit = coverFit(image.naturalWidth, image.naturalHeight, box);

  return (
    <Group
      // Fora de "brand-layer": a caixa do Konva ignora o recorte; a área da imagem é layer.region.
      name="image-layer"
      id={layer.id}
      clipFunc={(ctx) => {
        ctx.beginPath();
        ctx.moveTo(points[0], points[1]);
        for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
        ctx.closePath();
      }}
    >
      <KImage image={image} {...fit} />
    </Group>
  );
}
