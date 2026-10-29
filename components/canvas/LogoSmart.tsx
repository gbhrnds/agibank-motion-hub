"use client";

import { useEffect } from "react";
import { Group, Image as KImage } from "react-konva";
import { color, logoClearSpace, logoPath, pickLogoKey, type ColorKey } from "@/lib/brand-tokens";
import { CANVAS_SIZE, type LogoLayer } from "@/lib/alerta-spec";
import { useSvgAsset } from "@/lib/use-svg-asset";

/** Elemento do logo usado como unidade da área de proteção (logos.clearSpace.reference). */
const CLEAR_SPACE_REFERENCE_COLOR: Record<string, ColorKey> = {
  "pingo-verde-do-i": "verde",
};

export interface LogoMeta {
  /** Área de proteção em px (multiplier × tamanho da referência), ou null se a referência não foi encontrada. */
  clearSpace: number | null;
}

interface LogoSmartProps {
  layer: LogoLayer;
  backgroundColor: ColorKey;
  onReady?: (meta: LogoMeta) => void;
}

/**
 * Escolhe a versão do logo pelo fundo (logos.usageMap: fundo azul → negative, digital → rgb),
 * posiciona no canto inferior esquerdo e mede a área de proteção a partir do pingo verde do "i".
 */
export default function LogoSmart({ layer, backgroundColor, onReady }: LogoSmartProps) {
  const fundo = backgroundColor.startsWith("azul") ? "fundoAzul" : "fundoBranco";
  const src = logoPath(pickLogoKey(layer.brand, fundo, layer.midia));
  const referenceKey = CLEAR_SPACE_REFERENCE_COLOR[logoClearSpace.reference];
  const asset = useSvgAsset(src, { referenceFill: referenceKey ? color(referenceKey) : undefined });

  const scale = asset ? layer.width / asset.width : 0;
  const clearSpace =
    asset?.reference ? logoClearSpace.multiplier * Math.max(asset.reference.width, asset.reference.height) * scale : null;

  useEffect(() => {
    if (!asset) return;
    if (clearSpace === null) {
      console.error(`Referência de área de proteção "${logoClearSpace.reference}" não encontrada em ${src}`);
    }
    onReady?.({ clearSpace });
  }, [asset, clearSpace, src, onReady]);

  if (!asset) return null;
  const height = asset.height * scale;
  return (
    <Group name="brand-layer" id={layer.id}>
      <KImage
        image={asset.image}
        x={layer.margin}
        y={CANVAS_SIZE - layer.margin - height}
        width={layer.width}
        height={height}
      />
    </Group>
  );
}
