"use client";

import { useEffect, useState } from "react";
import { shapePath, type ShapeFile } from "./brand-tokens";
import type { Rect } from "./piece-spec";
import { fetchSvg } from "./svg-utils";

/** Contorno de um shape da marca (assets/shapes/*.svg: um único <path>), em coordenadas do viewBox. */
export interface ShapeOutline {
  file: string;
  d: string;
  width: number;
  height: number;
}

export function parseShapeSvg(file: string, svg: string): ShapeOutline {
  const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1].trim().split(/[\s,]+/).map(Number);
  const d = svg.match(/<path[^>]*\sd="([^"]+)"/)?.[1];
  if (!viewBox || viewBox.length !== 4 || !d) throw new Error(`Shape "${file}" sem viewBox ou <path>.`);
  return { file, d, width: viewBox[2], height: viewBox[3] };
}

/** Mesmo contorno, a partir do <svg> já baixado por fetchSvg (CDN de meta.cdnBase). */
export function outlineFromSvg(file: string, svg: SVGSVGElement): ShapeOutline {
  return parseShapeSvg(file, new XMLSerializer().serializeToString(svg));
}

/**
 * Encaixa o shape inteiro na caixa com escala uniforme (shapes.forbiddenTransforms: nunca distorcer),
 * centralizado. Devolve a matriz viewBox → peça e a caixa ocupada pelo shape.
 */
export function fitShape(shape: ShapeOutline, box: Rect): { k: number; tx: number; ty: number; bounds: Rect } {
  const k = Math.min(box.width / shape.width, box.height / shape.height);
  const width = shape.width * k;
  const height = shape.height * k;
  const tx = box.x + (box.width - width) / 2;
  const ty = box.y + (box.height - height) / 2;
  return { k, tx, ty, bounds: { x: tx, y: ty, width, height } };
}

export function useShapeOutline(file: string): ShapeOutline | null {
  const [outline, setOutline] = useState<ShapeOutline | null>(null);
  useEffect(() => {
    let alive = true;
    setOutline(null);
    // Mesmo fetch dos demais SVGs (lib/svg-utils.ts → fetchSvg): CDN do assets-map, cópia local de reserva.
    fetchSvg(shapePath(file as ShapeFile))
      .then((svg) => alive && setOutline(outlineFromSvg(file, svg)))
      .catch((err) => console.error(err));
    return () => {
      alive = false;
    };
  }, [file]);
  return outline?.file === file ? outline : null;
}
