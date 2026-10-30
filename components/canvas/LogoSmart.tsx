"use client";

import { useEffect } from "react";
import { Group, Image as KImage } from "react-konva";
import { color, logoClearSpace, logoSrcFor, type Audience, type ColorKey } from "@/lib/brand-tokens";
import { logoPosition, type LogoLayer, type Size } from "@/lib/piece-spec";
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
  /**
   * Para quem a peça fala — regra de marca em assets-map.json → logos.audienceRule:
   * - "interno": Comunicação Interna, Marca Empregadora institucional, ferramentas internos
   *   (Alerta SJ, Alerta Teams, Portal Sempre Juntos, crachás…) → logo REDUZIDO "Agi".
   * - "externo": clientes, mídia, lojas, feiras, material impresso externo → logo COMPLETO "Agibank".
   * Vem da cascata da barra lateral (lib/format-config.ts → pieceContext).
   */
  audience: Audience;
  layer: LogoLayer;
  /** Dimensões da peça (posição no canto/centro inferior). */
  size: Size;
  backgroundColor: ColorKey;
  onReady?: (meta: LogoMeta) => void;
}

/**
 * Escolhe o arquivo do logo em logos.files a partir de audiência + fundo + mídia
 * (interno/azul/digital → agi-negative-rgb; externo/branco/impresso → agibank-positive-cmyk; etc.),
 * posiciona no canto inferior esquerdo e mede a área de proteção a partir do pingo verde do "i"
 * do próprio logo renderizado — logo menor, área de proteção proporcionalmente menor.
 */
export default function LogoSmart({ audience, layer, size, backgroundColor, onReady }: LogoSmartProps) {
  // Material Impresso → arquivos "-cmyk.svg" obrigatoriamente (logoSrcFor valida).
  const src = logoSrcFor(audience, backgroundColor, layer.midia);
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
  const { x, y } = logoPosition(layer, size, height);
  return (
    <Group name="brand-layer" id={layer.id}>
      <KImage
        image={asset.image}
        x={x}
        y={y}
        width={layer.width}
        height={height}
      />
    </Group>
  );
}
