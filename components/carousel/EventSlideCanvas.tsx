"use client";

import type Konva from "konva";
import { useCallback, useMemo } from "react";
import { Group, Layer as KLayer, Path, Rect as KRect, Stage, Text as KText } from "react-konva";
import IconInline from "@/components/canvas/IconInline";
import LogoSmart from "@/components/canvas/LogoSmart";
import PolygonImage from "@/components/canvas/PolygonImage";
import RichText from "@/components/canvas/RichText";
import { color, fontStack, fontWeight, uiColor, type ColorKey, type FontWeightKey } from "@/lib/brand-tokens";
import { CAROUSEL_SIZE, nomeEstilizado, type Slide } from "@/lib/carousel";
import type { LogoLayer, TextLayer } from "@/lib/piece-spec";
import { breakText, measureText } from "@/lib/rich-text";
import { fitShape, useShapeOutline } from "@/lib/shape-mask";
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

/**
 * Grafismo da capa e do encerramento: um shape real da marca (assets/shapes/) na cor dos shapes
 * (assets-map shapes.color = azul Agibank), sangrando pela borda. Sem formas nem cores inventadas.
 */
const GRAFISMO = { capa: "quadrilateral-14.svg", encerramento: "triangle-06.svg" };

function BrandShape({ file, box }: { file: string; box: { x: number; y: number; width: number; height: number } }) {
  const shape = useShapeOutline(file);
  if (!shape) return null;
  const { k, tx, ty } = fitShape(shape, box);
  return <Path id="grafismo" data={shape.d} x={tx} y={ty} scaleX={k} scaleY={k} fill={color("azulAgibank")} />;
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
  const mascaraFile =
    slide.tipo === "convidado" ? (temaEvento.mascaras.find((m) => m.id === slide.mascaraId) ?? temaEvento.mascaras[0]).arquivo : GRAFISMO.capa;
  const mascara = useShapeOutline(mascaraFile);

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
      return { kind: "capa" as const, titulo, headline, data, cta: slide.cta || "Inscreva-se", seta: slide.seta };
    }

    if (slide.tipo === "convidado") {
      const label = textLayer("label", nome, { x: M, y: 84, width: 300, fontSize: 34, weight: "regular", color: cores.texto, highlight: nomeHighlight });
      const bio = fitHeight(
        textLayer("bio", slide.bio || "Mini bio do convidado.", { x: M, y: 820, width: W - M * 2, fontSize: 32, weight: "regular", color: cores.texto, lineHeight: 1.35 }),
        H - 820 - 56,
      );
      // Caixa da foto: metade direita, sangrando para cima e para a direita.
      const box = { x: 380, y: -40, width: 740, height: 720 };
      return { kind: "convidado" as const, label, bio, box };
    }

    const titulo = fitHeight(
      textLayer("nome-evento", nome, { x: M, y: 300, width: W - M * 2, fontSize: 96, weight: "regular", color: cores.texto, highlight: nomeHighlight, align: "center" }),
      230,
    );
    const ctaY = titulo.y + heightOf(titulo) + 56;
    const link = textLayer("link", slide.link || "agibank.com.br", {
      x: M,
      y: ctaY + CTA_HEIGHT + 40,
      width: W - M * 2,
      fontSize: 36,
      weight: "semiBold",
      color: cores.texto,
      align: "center",
    });
    return { kind: "encerramento" as const, titulo, cta: slide.cta || "Até o próximo encontro!", ctaY, seta: slide.seta, link };
  }, [fontsReady, slide, nomeEvento]);

  return (
    <Stage width={Math.round(W * previewScale)} height={Math.round(H * previewScale)} scaleX={previewScale} scaleY={previewScale} ref={stageRef}>
      <KLayer listening={false}>
        <KRect x={0} y={0} width={W} height={H} fill={color(cores.fundo)} />
        {content?.kind === "capa" && (
          <>
            <BrandShape file={GRAFISMO.capa} box={{ x: 760, y: 380, width: 420, height: 460 }} />
            <RichText layer={content.titulo} />
            <RichText layer={content.headline} />
            <RichText layer={content.data} />
            <CtaButton
              text={content.cta}
              x={M}
              y={Math.max(content.data.y + heightOf(content.data) + 64, 700)}
              fill={cores.tarjaSecundaria}
              textColor={cores.texto}
              seta={content.seta}
            />
            <LogoSmart audience="interno" layer={logoLayer("left", 150)} size={size} backgroundColor={cores.fundo} onReady={noop} />
          </>
        )}
        {content?.kind === "convidado" && slide.tipo === "convidado" && (
          <>
            {mascara && (
              // Sem foto: marcador neutro (nunca uma cor decorativa); com foto, a foto cobre 100% do shape.
              <PolygonImage key={mascara.file} id="foto" src={slide.foto} clip={{ shape: mascara, box: content.box }} placeholder={uiColor("grayBorder")} />
            )}
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
            <BrandShape file={GRAFISMO.encerramento} box={{ x: W - 300, y: H - 330, width: 380, height: 420 }} />
            <RichText layer={content.titulo} />
            <CtaButton
              text={content.cta}
              centerX={W / 2}
              y={content.ctaY}
              fill={cores.destaque}
              textColor={cores.textoSobreDestaque}
              seta={content.seta}
            />
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

const CTA_HEIGHT = 96;

/**
 * CTA como botão simples: retângulo com texto. O ícone de seta só entra quando o slide pede
 * (checkbox "Incluir ícone de seta"); nunca automaticamente.
 */
function CtaButton(props: { text: string; x?: number; centerX?: number; y: number; fill: ColorKey; textColor: ColorKey; seta: boolean }) {
  const padX = 44;
  const icon = 34;
  const gap = 16;
  let fontSize = 40;
  const extra = props.seta ? gap + icon : 0;
  while (fontSize > 20 && measureText(props.text, { color: props.textColor, weight: "bold" }, fontSize) + padX * 2 + extra > W - M * 2) fontSize -= 2;
  const textWidth = measureText(props.text, { color: props.textColor, weight: "bold" }, fontSize);
  const width = textWidth + padX * 2 + extra;
  const x = props.centerX !== undefined ? props.centerX - width / 2 : (props.x ?? M);
  const mid = props.y + CTA_HEIGHT / 2;
  return (
    <Group id="cta">
      <KRect x={x} y={props.y} width={width} height={CTA_HEIGHT} fill={color(props.fill)} />
      <KText
        x={x + padX}
        y={mid - fontSize / 2}
        text={props.text}
        fontSize={fontSize}
        fontFamily={fontStack}
        fontStyle={String(fontWeight("bold"))}
        fill={color(props.textColor)}
      />
      {props.seta && <IconInline file="chevron-right.svg" color={props.textColor} x={x + padX + textWidth + gap} y={mid - icon / 2} size={icon} />}
    </Group>
  );
}
