import { fontShorthand } from "./brand-tokens";
import type { TextStyle } from "./alerta-spec";
import { composition } from "./composition-tokens";
import { wrapWords } from "./text-wrap";

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
  pieces: { text: string; style: TextStyle; highlighted: boolean }[];
  space: { text: string; style: TextStyle } | null;
}

export const forbiddenTrailingWords: string[] = composition.typographyLineBreakRules.forbiddenTrailingWords;

/**
 * Passo 1 — quebra ANTES do Konva: mede cada palavra com a fonte/peso reais, quebra pela largura,
 * aplica a regra de viúvas (typographyLineBreakRules) e devolve o texto com "\n" explícitos,
 * preservando os marcadores **destaque** em cada linha.
 */
export function breakText(
  text: string,
  base: TextStyle,
  highlight: TextStyle | undefined,
  fontSize: number,
  maxWidth: number,
): string {
  const units: Unit[] = [];
  let pendingSpace: Unit["space"] = null;
  let current: Unit | null = null;

  for (const span of parseHighlights(text)) {
    const style = span.highlighted && highlight ? highlight : base;
    for (const part of span.text.split(/(\s+)/)) {
      if (!part) continue;
      if (/^\s+$/.test(part)) {
        pendingSpace = { text: " ", style };
        current = null;
      } else if (current && !pendingSpace) {
        current.pieces.push({ text: part, style, highlighted: span.highlighted });
      } else {
        current = { pieces: [{ text: part, style, highlighted: span.highlighted }], space: units.length ? pendingSpace : null };
        units.push(current);
        pendingSpace = null;
      }
    }
  }

  const lines = wrapWords(units, {
    maxWidth,
    widthOf: (u) => u.pieces.reduce((w, p) => w + measureText(p.text, p.style, fontSize), 0),
    spaceBefore: (u) => (u.space ? measureText(u.space.text, u.space.style, fontSize) : 0),
    wordOf: (u) => u.pieces.map((p) => p.text).join(""),
    forbiddenWords: forbiddenTrailingWords,
  });

  // Remonta cada linha com os marcadores, juntando trechos destacados vizinhos ("**Canal de Denúncias**").
  return lines
    .map((line) => {
      let out = "";
      let open = false;
      line.forEach((unit, u) => {
        unit.pieces.forEach((p, i) => {
          const sep = u > 0 && i === 0 ? " " : "";
          if (p.highlighted && !open) {
            out += `${sep}**${p.text}`;
            open = true;
          } else if (!p.highlighted && open) {
            out += `**${sep}${p.text}`;
            open = false;
          } else {
            out += `${sep}${p.text}`;
          }
        });
      });
      return open ? `${out}**` : out;
    })
    .join("\n");
}

/**
 * Passo 2 — posiciona o texto já quebrado: uma linha por "\n", um trecho por estilo
 * (sem nenhuma quebra automática).
 */
export function layoutBrokenText(
  broken: string,
  base: TextStyle,
  highlight: TextStyle | undefined,
  fontSize: number,
): PlacedPiece[] {
  const pieces: PlacedPiece[] = [];
  broken.split("\n").forEach((line, lineIndex) => {
    let x = 0;
    for (const span of parseHighlights(line)) {
      const style = span.highlighted && highlight ? highlight : base;
      pieces.push({ text: span.text, style, x, line: lineIndex });
      x += measureText(span.text, style, fontSize);
    }
  });
  return pieces;
}
