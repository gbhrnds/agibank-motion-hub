"use client";

import { useEffect } from "react";
import { Image as KImage } from "react-konva";
import { color, iconPath, type ColorKey, type IconFile } from "@/lib/brand-tokens";
import { useSvgAsset } from "@/lib/use-svg-asset";

interface IconInlineProps {
  file: IconFile;
  color: ColorKey;
  x: number;
  y: number;
  /** Caixa quadrada; o ícone é encaixado (contain) e centralizado nela. */
  size: number;
  onReady?: () => void;
}

export default function IconInline({ file, color: colorKey, x, y, size, onReady }: IconInlineProps) {
  const asset = useSvgAsset(iconPath(file), { recolor: { color: color(colorKey), mode: "fill" } });

  useEffect(() => {
    if (asset) onReady?.();
  }, [asset, onReady]);

  if (!asset) return null;
  const scale = size / Math.max(asset.width, asset.height);
  const width = asset.width * scale;
  const height = asset.height * scale;
  return (
    <KImage image={asset.image} x={x + (size - width) / 2} y={y + (size - height) / 2} width={width} height={height} />
  );
}
