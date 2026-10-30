"use client";

import { useMemo } from "react";
import { maskPolygon, type ImageMask } from "@/lib/image-mask";
import type { ImageLayer } from "@/lib/piece-spec";
import PolygonImage from "./PolygonImage";

interface MaskedImageProps {
  layer: ImageLayer;
  mask: ImageMask;
  onReady?: () => void;
}

/** Imagem enviada recortada por um polígono irregular que ocupa metade da peça (arquétipo máscara). */
export default function MaskedImage({ layer, mask, onReady }: MaskedImageProps) {
  const points = useMemo(() => maskPolygon(mask, layer.region, layer.placement), [mask, layer.region, layer.placement]);
  // Fora de "brand-layer": a caixa do Konva ignora o recorte; a área da imagem é layer.region.
  return <PolygonImage id={layer.id} src={layer.src} clip={{ points }} onReady={onReady} />;
}
