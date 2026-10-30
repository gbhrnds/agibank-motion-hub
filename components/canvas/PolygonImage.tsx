"use client";

import { useEffect, useState } from "react";
import { Group, Image as KImage, Line, Path } from "react-konva";
import { getCoverFit } from "@/lib/image-mask";
import type { Rect } from "@/lib/piece-spec";
import { fitShape, type ShapeOutline } from "@/lib/shape-mask";

/** Recorte da foto: polígono em px da peça, ou um shape da marca encaixado numa caixa. */
export type ImageClip = { points: number[] } | { shape: ShapeOutline; box: Rect };

interface PolygonImageProps {
  id: string;
  /** Data URL da foto; sem foto, desenha o recorte preenchido com `placeholder` (cor já resolvida). */
  src: string | null;
  clip: ImageClip;
  placeholder?: string;
  /** Nome do grupo no Konva (medição de layout). */
  name?: string;
  onReady?: () => void;
}

/** Caixa (bounding box) do recorte, em px da peça. */
function clipBounds(clip: ImageClip): Rect {
  if ("shape" in clip) return fitShape(clip.shape, clip.box).bounds;
  const xs = clip.points.filter((_, i) => i % 2 === 0);
  const ys = clip.points.filter((_, i) => i % 2 === 1);
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}

/** Path2D do shape já na escala/posição da peça. */
function shapePath2D(shape: ShapeOutline, box: Rect): Path2D {
  const { k, tx, ty } = fitShape(shape, box);
  const path = new Path2D();
  path.addPath(new Path2D(shape.d), new DOMMatrix([k, 0, 0, k, tx, ty]));
  return path;
}

/**
 * Dimensões naturais da foto. SVG sem width/height pode vir com naturalWidth 0: nesse caso usa o
 * tamanho de layout do elemento (que o navegador deriva do viewBox).
 */
function naturalSize(img: HTMLImageElement): { width: number; height: number } {
  return { width: img.naturalWidth || img.width || 1, height: img.naturalHeight || img.height || 1 };
}

/**
 * Foto recortada (clipFunc) por um polígono ou por um shape da marca. A foto é escalada e posicionada
 * ANTES do recorte para cobrir 100% da caixa do recorte (cover): sem distorção e sem sobra de fundo.
 */
export default function PolygonImage({ id, src, clip, placeholder, name = "image-layer", onReady }: PolygonImageProps) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    let alive = true;
    setImage(null);
    if (!src) return;
    const img = new window.Image();
    img.onload = () => alive && setImage(img);
    img.onerror = () => console.warn("Não foi possível abrir a imagem enviada.");
    img.src = src;
    return () => {
      alive = false;
    };
  }, [src]);

  useEffect(() => {
    if (image || !src) onReady?.();
  }, [image, src, onReady]);

  if (!src) {
    if (!placeholder) return null;
    if ("shape" in clip) {
      const { k, tx, ty } = fitShape(clip.shape, clip.box);
      return <Path id={id} name={name} data={clip.shape.d} x={tx} y={ty} scaleX={k} scaleY={k} fill={placeholder} />;
    }
    return <Line id={id} name={name} points={clip.points} closed fill={placeholder} />;
  }
  if (!image) return null;

  const box = clipBounds(clip);
  const img = naturalSize(image);
  const fit = getCoverFit(img.width, img.height, box.width, box.height);
  return (
    <Group
      name={name}
      id={id}
      clipFunc={(ctx) => {
        if ("shape" in clip) return [shapePath2D(clip.shape, clip.box)];
        const p = clip.points;
        ctx.beginPath();
        ctx.moveTo(p[0], p[1]);
        for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
        ctx.closePath();
      }}
    >
      <KImage
        image={image}
        x={box.x + fit.x}
        y={box.y + fit.y}
        width={img.width}
        height={img.height}
        scaleX={fit.scale}
        scaleY={fit.scale}
      />
    </Group>
  );
}
