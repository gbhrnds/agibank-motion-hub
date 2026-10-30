import { ctaGeometry } from "./cta-geometry";
import type { PieceLayout } from "./layout-engine";
import { formatScale, frameMargins, type Layer, type Size } from "./piece-spec";
import { breakText } from "./rich-text";

export type PieceStyle = Pick<PieceLayout, "alignment" | "ctaStyle" | "ctaColor">;

/** Altura do logo e da área de proteção (medidas no canvas) — reservadas no rodapé. */
export interface LogoFootprint {
  height: number;
  clearSpace: number;
}

/**
 * Aplica o estado global gerado pelo motor às camadas da peça: alinhamento de textos, CTA e logo
 * (textAndLayoutRules) e a variante do CTA (ctaRules.variants), com medidas escaladas para o formato.
 */
export function applyPieceStyle(layers: Layer[], piece: PieceStyle, size: Size): Layer[] {
  const center = piece.alignment === "center";
  const s = formatScale(size);
  const px = (v: number) => Math.round(v * s);
  const { x: marginX } = frameMargins(size);
  return layers.map((l) => {
    switch (l.type) {
      case "text":
        return { ...l, align: piece.alignment, x: center ? (size.width - l.width) / 2 : marginX };
      case "logo":
        return { ...l, align: piece.alignment };
      case "cta": {
        const base = { ...l, align: piece.alignment, x: marginX, variant: piece.ctaStyle };
        if (piece.ctaStyle === "pill-solid-accent") {
          // Fundo verde, texto azul escuro, sombra sutil.
          return { ...base, color: "azulEscuro", weight: "semiBold", pill: { fill: "verde", paddingX: px(28), paddingY: px(18), shadow: "shadowSubtle" } };
        }
        if (piece.ctaStyle === "pill-outline") {
          // Fundo transparente, borda de 2px; o texto acompanha a cor da borda.
          return { ...base, color: piece.ctaColor, weight: "semiBold", pill: { stroke: piece.ctaColor, strokeWidth: Math.max(2, px(2)), paddingX: px(28), paddingY: px(16) } };
        }
        // "text-only-arrow": sem caixa, texto bold + seta.
        return { ...base, color: piece.ctaColor, weight: "bold", fontSize: px(20), pill: undefined };
      }
      default:
        return l;
    }
  });
}

/** Altura do bloco de texto já quebrado (mesma quebra do canvas). */
function textHeight(l: Extract<Layer, { type: "text" }>): number {
  const lines = breakText(l.text, l, l.highlight, l.fontSize, l.width).split("\n").length;
  return lines * l.fontSize * l.lineHeight;
}

/**
 * Posiciona headline, corpo e CTA na vertical: bloco centralizado na peça, sem invadir o rodapé
 * do logo (altura + área de proteção). Espaços entre blocos escalados do Alerta 600×600.
 * Precisa das fontes carregadas (mede o texto).
 */
export function composeLayers(layers: Layer[], size: Size, piece: PieceStyle | null, logo: LogoFootprint | null): Layer[] {
  const styled = piece ? applyPieceStyle(layers, piece, size) : layers;
  const s = formatScale(size);
  const { y: marginY } = frameMargins(size);
  const gapAfter: Record<string, number> = { titulo: 13 * s, corpo: 40 * s };

  const flow = styled.filter((l) => l.type === "text" || l.type === "cta");
  const heights = flow.map((l) => (l.type === "text" ? textHeight(l) : ctaGeometry({ ...l, y: 0 }, size.width).box.height));
  const gaps = flow.map((l, i) => (i < flow.length - 1 && l.type === "text" ? gapAfter[l.role] : 0));
  const block = heights.reduce((a, b) => a + b, 0) + gaps.reduce((a, b) => a + b, 0);

  const logoLayer = styled.find((l) => l.type === "logo");
  const logoHeight = logo?.height ?? (logoLayer?.type === "logo" ? logoLayer.width * 0.45 : 0);
  const clear = logo?.clearSpace ?? logoHeight * 0.5;
  // Folga acima da área de proteção do logo (inclui a sombra do CTA).
  const maxBottom = size.height - marginY - logoHeight - clear - 24 * s;
  let y = Math.max(marginY, Math.min((size.height - block) / 2, maxBottom - block));

  const ys = new Map<string, number>();
  flow.forEach((l, i) => {
    ys.set(l.id, Math.round(y));
    y += heights[i] + gaps[i];
  });
  return styled.map((l) => (ys.has(l.id) ? { ...l, y: ys.get(l.id)! } : l));
}
