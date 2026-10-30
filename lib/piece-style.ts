import { CANVAS_SIZE, type Layer } from "./alerta-spec";
import type { PieceLayout } from "./layout-engine";

/** Margem lateral do texto alinhado à esquerda. */
const LEFT_MARGIN = 32;

/**
 * Aplica o estado global gerado pelo motor às camadas da peça: alinhamento de textos, CTA e logo
 * (textAndLayoutRules) e a variante do CTA (ctaRules.variants). Não mede nada — o CTA centralizado
 * e as linhas de texto se posicionam na renderização.
 */
export function applyPieceStyle(layers: Layer[], piece: Pick<PieceLayout, "alignment" | "ctaStyle" | "ctaColor">): Layer[] {
  const center = piece.alignment === "center";
  return layers.map((l) => {
    switch (l.type) {
      case "text":
        return { ...l, align: piece.alignment, x: center ? (CANVAS_SIZE - l.width) / 2 : LEFT_MARGIN };
      case "logo":
        return { ...l, align: piece.alignment };
      case "cta": {
        const base = { ...l, align: piece.alignment, x: LEFT_MARGIN, variant: piece.ctaStyle };
        if (piece.ctaStyle === "pill-solid-accent") {
          // Fundo verde, texto azul escuro, sombra sutil.
          return { ...base, color: "azulEscuro", weight: "semiBold", pill: { fill: "verde", paddingX: 28, paddingY: 18, shadow: "shadowSubtle" } };
        }
        if (piece.ctaStyle === "pill-outline") {
          // Fundo transparente, borda de 2px; o texto acompanha a cor da borda.
          return { ...base, color: piece.ctaColor, weight: "semiBold", pill: { stroke: piece.ctaColor, strokeWidth: 2, paddingX: 28, paddingY: 16 } };
        }
        // "text-only-arrow": sem caixa, texto bold + seta.
        return { ...base, color: piece.ctaColor, weight: "bold", fontSize: 20, pill: undefined };
      }
      default:
        return l;
    }
  });
}
