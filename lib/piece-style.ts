import { ctaGeometry } from "./cta-geometry";
import type { PieceLayout } from "./layout-engine";
import { formatScale, frameMargins, getImage, type Layer, type Size } from "./piece-spec";
import { breakText, forbiddenTrailingWords } from "./rich-text";
import { normalizeWord } from "./text-wrap";

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
  // Com imagem na metade direita, o texto fica alinhado à esquerda (centralizado invadiria a imagem).
  const center = piece.alignment === "center" && getImage(layers)?.placement !== "right";
  const s = formatScale(size);
  const px = (v: number) => Math.round(v * s);
  const { x: marginX } = frameMargins(size);
  return layers.map((l) => {
    switch (l.type) {
      case "text":
        return { ...l, align: center ? "center" : "left", x: center ? (size.width - l.width) / 2 : marginX };
      case "logo":
        return { ...l, align: center ? "center" : "left" };
      case "cta": {
        const base = { ...l, align: center ? ("center" as const) : ("left" as const), x: marginX, variant: piece.ctaStyle };
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

const forbidden = new Set(forbiddenTrailingWords.map(normalizeWord));

/** Alguma linha (exceto a última) termina em artigo/preposição/conjunção? */
function hasWidow(l: Extract<Layer, { type: "text" }>): boolean {
  const lines = breakText(l.text, l, l.highlight, l.fontSize, l.width).split("\n");
  return lines.slice(0, -1).some((line) => forbidden.has(normalizeWord(line.replace(/\*\*/g, "").split(" ").pop() ?? "")));
}

/**
 * Em colunas estreitas (ex.: imagem ocupando metade da peça) a regra de viúvas pode não ter saída:
 * "de complicar." não cabe na linha. Reduz a fonte em passos de 5% (até 70%) até a quebra ficar válida.
 */
function fitText(l: Extract<Layer, { type: "text" }>): Extract<Layer, { type: "text" }> {
  let fitted = l;
  for (let k = 0.95; hasWidow(fitted) && k >= 0.7; k -= 0.05) fitted = { ...l, fontSize: Math.round(l.fontSize * k) };
  return fitted;
}

/** Encolhe o CTA (fonte, padding e ícone juntos, até 60%) para não passar de `maxRight`. */
function fitCta(l: Extract<Layer, { type: "cta" }>, canvasWidth: number, maxRight: number): Extract<Layer, { type: "cta" }> {
  const scaled = (k: number): Extract<Layer, { type: "cta" }> => ({
    ...l,
    fontSize: Math.round(l.fontSize * k),
    pill: l.pill && { ...l.pill, paddingX: Math.round(l.pill.paddingX * k), paddingY: Math.round(l.pill.paddingY * k) },
    trailingIcon: l.trailingIcon && { ...l.trailingIcon, size: Math.round(l.trailingIcon.size * k), gap: Math.round(l.trailingIcon.gap * k) },
  });
  let fitted = l;
  for (let k = 0.95; k >= 0.6; k -= 0.05) {
    const box = ctaGeometry(fitted, canvasWidth).box;
    if (box.x + box.width <= maxRight) break;
    fitted = scaled(k);
  }
  return fitted;
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
  const s = formatScale(size);
  const imageLayer = getImage(layers);
  // Com imagem à direita, nada do bloco de texto passa da borda interna da imagem.
  const maxRight = imageLayer?.placement === "right" ? imageLayer.region.x - 24 * s : size.width;
  const styled = (piece ? applyPieceStyle(layers, piece, size) : layers).map((l) =>
    l.type === "text" ? fitText(l) : l.type === "cta" ? fitCta(l, size.width, maxRight) : l,
  );
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
  // Com imagem na metade de cima, o bloco de texto fica na metade de baixo.
  const image = getImage(styled);
  const top = image?.placement === "top" ? image.region.y + image.region.height + 24 * s : marginY;
  const center = image?.placement === "top" ? (top + maxBottom - block) / 2 : (size.height - block) / 2;
  let y = Math.max(top, Math.min(center, maxBottom - block));

  const ys = new Map<string, number>();
  flow.forEach((l, i) => {
    ys.set(l.id, Math.round(y));
    y += heights[i] + gaps[i];
  });
  return styled.map((l) => (ys.has(l.id) ? { ...l, y: ys.get(l.id)! } : l));
}
