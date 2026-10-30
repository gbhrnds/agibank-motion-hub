"use client";

import type Konva from "konva";
import { CAROUSEL_SIZE, nomeDoEvento, SLIDE_LABEL, type Slide } from "@/lib/carousel";
import EventSlideCanvas from "./EventSlideCanvas";

/** Lado do preview de cada slide na tela (o export usa 1080×1080). */
const PREVIEW_SIDE = 420;

interface CarouselPreviewProps {
  slides: Slide[];
  /** Recebe o Stage de cada slide, na ordem exibida (usado pelo PDF de várias páginas). */
  registerStage: (id: string, stage: Konva.Stage | null) => void;
}

/** Slides do carrossel em sequência horizontal, com rolagem. */
export default function CarouselPreview({ slides, registerStage }: CarouselPreviewProps) {
  const nomeEvento = nomeDoEvento(slides);
  const scale = PREVIEW_SIDE / CAROUSEL_SIZE.width;
  if (slides.length === 0) {
    return <p className="text-center text-sm text-slate-500">Adicione slides na barra lateral.</p>;
  }
  return (
    <div className="flex snap-x gap-8 overflow-x-auto pb-6" data-testid="carousel-preview">
      {slides.map((slide, i) => (
        <figure key={slide.id} className="flex shrink-0 snap-start flex-col gap-2" data-testid={`slide-${i + 1}`} data-tipo={slide.tipo} data-mascara={slide.tipo === "convidado" ? slide.mascaraId : undefined}>
          <figcaption className="text-xs font-semibold text-slate-500">
            {i + 1}/{slides.length} · {SLIDE_LABEL[slide.tipo]}
          </figcaption>
          <div className="overflow-hidden rounded-md shadow-2xl" style={{ width: PREVIEW_SIDE, height: PREVIEW_SIDE }}>
            <EventSlideCanvas
              slide={slide}
              nomeEvento={nomeEvento}
              index={i}
              total={slides.length}
              previewScale={scale}
              stageRef={(stage) => registerStage(slide.id, stage)}
            />
          </div>
        </figure>
      ))}
    </div>
  );
}
