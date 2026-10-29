import { fontShorthand } from "./brand-tokens";
import type { TextStyle } from "./alerta-spec";

/**
 * Texto com trechos destacados (**assim**) e quebra de linha por palavra.
 * O Konva não tem rich text: cada trecho vira um Konva.Text posicionado aqui.
 */

export interface RichSpan {
  text: string;
  highlighted: boolean;
}

export interface PlacedPiece {
  text: string;
  style: TextStyle;
  x: number;
  line: number;
}

const sameStyle = (a: TextStyle, b: TextStyle) => a.color === b.color && a.weight === b.weight;

export function parseHighlights(text: string): RichSpan[] {
  return text
    .split(/(\*\*[^*]+\*\*)/)
    .filter(Boolean)
    .map((part) =>
      part.startsWith("**") && part.endsWith("**")
        ? { text: part.slice(2, -2), highlighted: true }
        : { text: part, highlighted: false },
    );
}

export function hasHighlight(text: string): boolean {
  return parseHighlights(text).some((s) => s.highlighted);
}

let ctx: CanvasRenderingContext2D | null = null;
export function measureText(text: string, style: TextStyle, fontSize: number): number {
  ctx ??= document.createElement("canvas").getContext("2d");
  if (!ctx) return 0;
  ctx.font = fontShorthand(style.weight, fontSize);
  return ctx.measureText(text).width;
}

interface Unit {
  pieces: { text: string; style: TextStyle }[];
  space: { text: string; style: TextStyle } | null;
}

/** Quebra gulosa por palavra; uma "palavra" pode atravessar estilos (ex.: "**Pix**!"). */
export function layoutRichText(
  spans: RichSpan[],
  base: TextStyle,
  highlight: TextStyle | undefined,
  fontSize: number,
  maxWidth: number,
): { pieces: PlacedPiece[]; lines: number } {
  const units: Unit[] = [];
  let pendingSpace: Unit["space"] = null;
  let current: Unit | null = null;

  for (const span of spans) {
    const style = span.highlighted && highlight ? highlight : base;
    for (const part of span.text.split(/(\s+)/)) {
      if (!part) continue;
      if (/^\s+$/.test(part)) {
        pendingSpace = { text: " ", style };
        current = null;
      } else if (current && !pendingSpace) {
        current.pieces.push({ text: part, style });
      } else {
        current = { pieces: [{ text: part, style }], space: units.length ? pendingSpace : null };
        units.push(current);
        pendingSpace = null;
      }
    }
  }

  const pieces: PlacedPiece[] = [];
  let line = 0;
  let x = 0;
  for (const unit of units) {
    const widths = unit.pieces.map((p) => measureText(p.text, p.style, fontSize));
    const unitWidth = widths.reduce((a, b) => a + b, 0);
    const spaceWidth = unit.space ? measureText(unit.space.text, unit.space.style, fontSize) : 0;
    let joinWithSpace = false;
    if (x > 0 && x + spaceWidth + unitWidth > maxWidth) {
      line += 1;
      x = 0;
    } else {
      x += spaceWidth;
      joinWithSpace = unit.space !== null;
    }
    unit.pieces.forEach((p, i) => {
      const prev = pieces[pieces.length - 1];
      // Junta palavras vizinhas do mesmo estilo num único nó (menos Konva.Text).
      if (i === 0 && joinWithSpace && prev && prev.line === line && sameStyle(prev.style, p.style) && sameStyle(unit.space!.style, p.style)) {
        prev.text += ` ${p.text}`;
      } else {
        pieces.push({ text: p.text, style: p.style, x, line });
      }
      x += widths[i];
    });
  }
  return { pieces, lines: line + 1 };
}
