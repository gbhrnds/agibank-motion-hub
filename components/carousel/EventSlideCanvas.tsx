"use client";

import type Konva from "konva";
import { useCallback, useMemo } from "react";
import { Circle, Group, Layer as KLayer, Line, Rect as KRect, Stage, Text as KText } from "react-konva";
import IconInline from "@/components/canvas/IconInline";
import LogoSmart from "@/components/canvas/LogoSmart";
import PolygonImage from "@/components/canvas/PolygonImage";
import RichText from "@/components/canvas/RichText";
import { color, fontStack, fontWeight, type FontWeightKey } from "@/lib/brand-tokens";
import { CAROUSEL_SIZE, nomeEstilizado, type Slide } from "@/lib/carousel";
import type { LogoLayer, TextLayer } from "@/lib/piece-spec";
import { breakText, measureText } from "@/lib/rich-text";
import { temaEvento } from "@/lib/theme-config";
import { useBrandFonts } from "@/lib/use-brand-fonts";

const W = CAROUSEL_SIZE.width;
const H = CAROUSEL_SIZE.height;
const M = 90;
const cores = temaEvento.cores;
const WEIGHTS: FontWeightKey[] = ["regular", "semiBold", "bold", "extraBold"];

interface EventSlideCanvasProps {
  slide: Slide;
  /** Nome do evento (da capa), repetido nos demais slides. */
  nomeEvento: string;
  index: number;
  total: number;
  previewScale: number;
  stageRef: (stage: Konva.Stage | null) => void;
}

type TextOpts = Omit<Partial<TextLayer>, "type"> & Pick<TextLayer, "x" | "y" | "width" | "fontSize" | "weight" | "color">;

function textLayer(id: string, text: string, o: TextOpts): TextLayer {
  return { id, label: id, type: "text", role: "corpo", lineHeight: 1.15, align: "left", text, ...o };
}

/** Altura do texto já quebrado (mesma quebra do canvas). */
function heightOf(l: TextLayer): number {
  if (!l.text.trim()) return 0;
  return breakText(l.text, l, l.highlight, l.fontSize, l.width).split("\n").length * l.fontSize * l.lineHeight;
}

/** Reduz a fonte (até 55%) até o texto caber em `maxHeight`. */
function fitHeight(l: TextLayer, maxHeight: number): TextLayer {
  let fitted = l;
  for (let k = 0.95; heightOf(fitted) > maxHeight && k >= 0.55; k -= 0.05) fitted = { ...l, fontSize: Math.round(l.fontSize * k) };
  return fitted;
}

/** Tarja: retângulo de cor com uma linha de texto; a fonte encolhe para caber em `maxWidth`. */
function Tarja(props: { id: string; text: string; x: number; y: number; height: number; fill: "verde" | "azulAgibank"; textColor: "azulEscuro" | "branco"; weight: FontWeightKey; fontSize: number; maxWidth: number }) {
  const padX = 36;
  let size = props.fontSize;
  while (size > 16 && measureText(props.text, { color: props.textColor, weight: props.weight }, size) + padX * 2 > props.maxWidth) size -= 2;
  const width = measureText(props.text, { color: props.textColor, weight: props.weight }, size) + padX * 2;
  return (
    <Group id={props.id}>
      <KRect x={props.x} y={props.y} width={width} height={props.height} fill={color(props.fill)} />
      <KText
        x={props.x + padX}
        y={props.y + (props.height - size) / 2}
        text={props.text}
        fontSize={size}
        fontFamily={fontStack}
        fontStyle={String(fontWeight(props.weight))}
        fill={color(props.textColor)}
      />
    </Group>
  );
}

/** Losango em contorno verde (grafismo decorativo da capa e do encerramento). */
function Losango({ cx, cy, size, opacity = 1 }: { cx: number; cy: number; size: number; opacity?: number }) {
  const r = size / 2;
  return (
    <Line
      points={[cx, cy - r, cx + r * 0.82, cy, cx, cy + r, cx - r * 0.82, cy]}
      closed
      stroke={color(cores.destaque)}
      strokeWidth={8}
      opacity={opacity}
    />
  );
}

const logoLayer = (align: "left" | "center", width: number): LogoLayer => ({
  id: "logo",
  label: "Logo",
  type: "logo",
  // temaEvento.logo = "agi" → audiência interna (logos.audienceRule.interno.logoFamily).
  audience: "interno",
  midia: "digital",
  marginX: M,
  marginY: 72,
  width,
  align,
});

/**
 * Slide 1080×1080 do carrossel de evento (tema "Evento"): capa, convidado (foto mascarada + tarjas
 * + bio) ou encerramento. Cores e máscaras vêm de lib/theme-config.ts → temaEvento.
 */
export default function EventSlideCanvas({ slide, nomeEvento, index, total, previewScale, stageRef }: EventSlideCanvasProps) {
  const fontsReady = useBrandFonts(WEIGHTS);
  const noop = useCallback(() => {}, []);
  const size = useMemo(() => ({ width: W, height: H }), []);

  const content = useMemo(() => {
    if (!fontsReady) return null;
    const nome = nomeEstilizado(nomeEvento || "Nome do Evento");
    const nomeHighlight = { color: cores.texto, weight: "extraBold" as const };

    if (slide.tipo === "capa") {
      const titulo = fitHeight(
        textLayer("nome-evento", nome, { x: M, y: 150, width: 760, fontSize: 104, weight: "regular", color: cores.texto, highlight: nomeHighlight }),
        260,
      );
      const headline = fitHeight(
        textLayer("headline", slide.headline || "Headline do evento", {
          x: M,
          y: titulo.y + heightOf(titulo) + 48,
          width: 820,
          fontSize: 76,
          weight: "extraBold",
          // Verde fica reservado para a data (destaque da capa).
          color: cores.texto,
          role: "titulo",
        }),
        260,
      );
      const data = textLayer("data", slide.data || "Data do evento", {
        x: M,
        y: headline.y + heightOf(headline) + 36,
        width: 820,
        fontSize: 44,
        weight: "bold",
        color: cores.destaque,
      });
      return { kind: "capa" as const, titulo, headline, data, cta: slide.cta || "Inscreva-se" };
    }

    if (slide.tipo === "convidado") {
      const label = textLayer("label", nome, { x: M, y: 84, width: 300, fontSize: 34, weight: "regular", color: cores.texto, highlight: nomeHighlight });
      const bio = fitHeight(
        textLayer("bio", slide.bio || "Mini bio do convidado.", { x: M, y: 820, width: W - M * 2, fontSize: 32, weight: "regular", color: cores.texto, lineHeight: 1.35 }),
        H - 820 - 56,
      );
      // Caixa da foto: metade direita, sangrando para cima e para a direita.
      const box = { x: 380, y: -40, width: 740, height: 720 };
      const mascara = temaEvento.mascaras.find((m) => m.id === slide.mascaraId) ?? temaEvento.mascaras[0];
      const points = mascara.pontos.flatMap(([u, v]) => [box.x + u * box.width, box.y + v * box.height]);
      return { kind: "convidado" as const, label, bio, points, mascara: mascara.id };
    }

    const titulo = fitHeight(
      textLayer("nome-evento", nome, { x: M, y: 300, width: W - M * 2, fontSize: 96, weight: "regular", color: cores.texto, highlight: nomeHighlight, align: "center" }),
      230,
    );
    const cta = fitHeight(
      textLayer("cta", slide.cta || "Até o próximo encontro!", {
        x: M,
        y: titulo.y + heightOf(titulo) + 56,
        width: W - M * 2,
        fontSize: 56,
        weight: "extraBold",
        color: cores.destaque,
        align: "center",
        role: "titulo",
      }),
      150,
    );
    const link = textLayer("link", slide.link || "agibank.com.br", {
      x: M,
      y: cta.y + heightOf(cta) + 28,
      width: W - M * 2,
      fontSize: 36,
      weight: "semiBold",
      color: cores.texto,
      align: "center",
    });
    return { kind: "encerramento" as const, titulo, cta, link };
  }, [fontsReady, slide, nomeEvento]);

  return (
    <Stage width={Math.round(W * previewScale)} height={Math.round(H * previewScale)} scaleX={previewScale} scaleY={previewScale} ref={stageRef}>
      <KLayer listening={false}>
        <KRect x={0} y={0} width={W} height={H} fill={color(cores.fundo)} />
        {content?.kind === "capa" && (
          <>
            <Losango cx={960} cy={600} size={600} />
            <RichText layer={content.titulo} />
            <RichText layer={content.headline} />
            <RichText layer={content.data} />
            <CtaCircle text={content.cta} y={Math.max(content.data.y + heightOf(content.data) + 64, 700)} />
            <LogoSmart audience="interno" layer={logoLayer("left", 150)} size={size} backgroundColor={cores.fundo} onReady={noop} />
          </>
        )}
        {content?.kind === "convidado" && slide.tipo === "convidado" && (
          <>
            <PolygonImage key={content.mascara} id="foto" src={slide.foto} points={content.points} placeholder="azulMedio" />
            <RichText layer={content.label} />
            <Tarja
              id="tarja-nome"
              text={slide.nome || "Nome do convidado"}
              x={M}
              y={600}
              height={104}
              fill={cores.destaque}
              textColor={cores.textoSobreDestaque}
              weight="extraBold"
              fontSize={54}
              maxWidth={W - M * 2}
            />
            <Tarja
              id="tarja-cargo"
              text={slide.cargoEmpresa || "Cargo · Empresa"}
              x={M}
              y={704}
              height={70}
              fill={cores.tarjaSecundaria}
              textColor={cores.texto}
              weight="semiBold"
              fontSize={32}
              maxWidth={W - M * 2}
            />
            <RichText layer={content.bio} />
          </>
        )}
        {content?.kind === "encerramento" && (
          <>
            <Losango cx={W - 60} cy={H - 40} size={620} />
            <RichText layer={content.titulo} />
            <RichText layer={content.cta} />
            <RichText layer={content.link} />
            <LogoSmart audience="interno" layer={logoLayer("center", 150)} size={size} backgroundColor={cores.fundo} onReady={noop} />
          </>
        )}
        {fontsReady && total > 1 && (
          <KText
            x={W - M - 200}
            y={84}
            width={200}
            align="right"
            text={`${String(index + 1).padStart(2, "0")}/${String(total).padStart(2, "0")}`}
            fontSize={30}
            fontFamily={fontStack}
            fontStyle={String(fontWeight("semiBold"))}
            fill={color(cores.texto)}
          />
        )}
      </KLayer>
    </Stage>
  );
}

/** CTA da capa: texto + seta dentro de um círculo azul. */
function CtaCircle({ text, y }: { text: string; y: number }) {
  const fontSize = 40;
  const r = 38;
  const width = measureText(text, { color: cores.texto, weight: "bold" }, fontSize);
  const cx = M + width + 28 + r;
  return (
    <Group id="cta">
      <KText x={M} y={y + r - fontSize / 2} text={text} fontSize={fontSize} fontFamily={fontStack} fontStyle={String(fontWeight("bold"))} fill={color(cores.texto)} />
      <Circle x={cx} y={y + r} radius={r} fill={color(cores.tarjaSecundaria)} />
      <IconInline file="chevron-right.svg" color={cores.texto} x={cx - 18} y={y + r - 18} size={36} />
    </Group>
  );
}
