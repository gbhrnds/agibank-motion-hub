"use client";

import { useEffect, useState } from "react";
import { Group, Image as KImage, Line } from "react-konva";
import { color, type ColorKey } from "@/lib/brand-tokens";
import { coverFit } from "@/lib/image-mask";

interface PolygonImageProps {
  id: string;
  /** Data URL da foto; sem foto, desenha o polígono preenchido com `placeholder`. */
  src: string | null;
  /** Polígono em px da peça (lista plana x0, y0, x1, y1…). */
  points: number[];
  placeholder?: ColorKey;
  /** Nome do grupo no Konva (medição de layout). */
  name?: string;
  onReady?: () => void;
}

/** Foto recortada (clipFunc) por um polígono irregular, preenchendo a caixa do polígono ("cover"). */
export default function PolygonImage({ id, src, points, placeholder, name = "image-layer", onReady }: PolygonImageProps) {
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
    return placeholder ? <Line id={id} name={name} points={points} closed fill={color(placeholder)} /> : null;
  }
  if (!image) return null;

  const xs = points.filter((_, i) => i % 2 === 0);
  const ys = points.filter((_, i) => i % 2 === 1);
  const box = { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
  return (
    <Group
      name={name}
      id={id}
      clipFunc={(ctx) => {
        ctx.beginPath();
        ctx.moveTo(points[0], points[1]);
        for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
        ctx.closePath();
      }}
    >
      <KImage image={image} {...coverFit(image.naturalWidth, image.naturalHeight, box)} />
    </Group>
  );
}
