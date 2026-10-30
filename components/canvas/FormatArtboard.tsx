"use client";

import type Konva from "konva";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CanvasLayout } from "@/lib/canvas-layout";
import { exportStage, type ExportFormat } from "@/lib/export";
import { logoSrcFor } from "@/lib/brand-tokens";
import { shapePalettes } from "@/lib/composition-tokens";
import { channelsFor, type FormatSpec, type PieceContext, type PieceTexts, type Side } from "@/lib/format-config";
import { pickMask } from "@/lib/image-mask";
import { logoMetricsFrom, predictKeepOut, type LogoMetrics } from "@/lib/keep-out";
import { generateRandomLayout, SHAPE_UNIT, shapesId, type PieceLayout, type PieceRun } from "@/lib/layout-engine";
import { buildLayers, formatScale, getBackground, getImage, getLogo, type Layer } from "@/lib/piece-spec";
import { composeLayers } from "@/lib/piece-style";
import type { Silhouette } from "@/lib/shape-silhouette";
import { useBrandFonts } from "@/lib/use-brand-fonts";
import { useDebounced } from "@/lib/use-debounced";
import { validatePiece } from "@/lib/validate-piece";
import DesignCanvas from "./DesignCanvas";

/** Caixa máxima do preview na tela; formatos maiores são reduzidos (o export sai no tamanho real). */
const PREVIEW_MAX = { width: 560, height: 480 };
const EXPORT_FORMATS: { format: ExportFormat; label: string }[] = [
  { format: "png", label: "PNG" },
  { format: "jpg", label: "JPG" },
  { format: "pdf", label: "PDF" },
];

interface FormatArtboardProps {
  format: FormatSpec;
  ctx: PieceContext;
  /** Textos digitados na barra lateral. */
  texts: PieceTexts;
  /** Data URL da imagem enviada (recortada por uma máscara na frente). */
  image: string | null;
  /** Lado da peça impressa; peças digitais são sempre "frente". */
  side?: Side;
  /** Estado global do desdobramento (alinhamento, CTA, paleta, arquétipo); null até o primeiro sorteio. */
  run: PieceRun | null;
  silhouettes: Record<string, Silhouette> | null;
}

/** Variação do seed por formato: mesmo estado global, shapes próprios para cada proporção. */
function seedFor(run: PieceRun, formatId: string): number {
  let h = run.seed >>> 0;
  for (const ch of formatId) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h;
}

function fontWeightsUsed(layers: Layer[]) {
  // "bold" entra sempre: é o peso do CTA "text-only-arrow".
  return [
    "bold" as const,
    ...layers.flatMap((l) => {
      if (l.type === "text") return l.highlight ? [l.weight, l.highlight.weight] : [l.weight];
      if (l.type === "cta") return [l.weight];
      return [];
    }),
  ];
}

/** Uma prancheta do desdobramento: compõe a peça no formato, gera os shapes, valida (console) e exporta. */
export default function FormatArtboard({ format, ctx, texts, image, side = "frente", run, silhouettes }: FormatArtboardProps) {
  const size = useMemo(() => ({ width: format.width, height: format.height }), [format.width, format.height]);
  const base = useMemo(
    () => buildLayers(size, { audience: ctx.audience, midia: ctx.midia, content: texts, side, image }),
    [size, ctx.audience, ctx.midia, texts, side, image],
  );
  // Os shapes se reposicionam quando o texto para de mudar (o texto em si atualiza na hora).
  const generationBase = useDebounced(base, 300);
  const background = getBackground(base)!.color;
  const sideKey = `${format.id}:${side}`;
  const mask = useMemo(() => (run ? pickMask(seedFor(run, sideKey)) : undefined), [run, sideKey]);
  const fontsReady = useBrandFonts(useMemo(() => fontWeightsUsed(base), [base]));

  const stageRef = useRef<Konva.Stage | null>(null);
  const [layout, setLayout] = useState<CanvasLayout | null>(null);
  const [logoMetrics, setLogoMetrics] = useState<LogoMetrics | null>(null);
  // Shapes gerados e as camadas (debounced) para as quais foram gerados.
  const [generated, setGenerated] = useState<{ piece: PieceLayout; for: Layer[] } | null>(null);
  const piece = generated?.piece ?? null;
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);

  const layers = useMemo(
    () => (fontsReady ? composeLayers(base, size, piece, logoMetrics) : null),
    [fontsReady, base, size, piece, logoMetrics],
  );

  // Tamanho do logo e da área de proteção: medidos uma vez no canvas (antes dos shapes).
  useEffect(() => {
    if (layout && layers && !logoMetrics) setLogoMetrics(logoMetricsFrom(layers, layout));
  }, [layout, layers, logoMetrics]);

  // Cada novo desdobramento (ou texto/imagem novos) gera shapes para este formato com o estado global sorteado.
  useEffect(() => {
    if (!run || !silhouettes || !logoMetrics) return;
    const genBackground = getBackground(generationBase)!.color;
    const masked = !!getImage(generationBase);
    // Verso: layout limpo — CTA sólido, só textura de shapes pequenos, paleta do fundo branco.
    const style =
      side === "verso"
        ? { ctaStyle: "pill-solid-accent" as const, ctaColor: "azulEscuro" as const, archetype: "textura-espalhada" as const }
        : {
            // "text-only-arrow" é texto + seta: sem a seta pedida pelo usuário, o CTA vira o contorno (mesma cor).
            ctaStyle: run.ctaStyle === "text-only-arrow" && !texts.ctaArrow ? ("pill-outline" as const) : run.ctaStyle,
            ctaColor: run.ctaColor,
            palette: run.palette,
            preferArchetype: run.archetype,
          };
    const seed = seedFor(run, sideKey);
    const empty = (): PieceLayout => ({
      seed,
      alignment: run.alignment,
      ctaStyle: style.ctaStyle,
      ctaColor: style.ctaColor,
      shapeArchetype: side === "verso" ? "textura-espalhada" : run.archetype,
      shapePalette: shapePalettes(genBackground)[0],
      unit: SHAPE_UNIT * formatScale(size),
      shapes: [],
    });
    // Arquétipo máscara: a imagem recortada é o grafismo da peça (sem shapes soltos).
    if (masked) {
      setGenerated({ piece: empty(), for: generationBase });
      setError(null);
      return;
    }
    try {
      setGenerated({
        for: generationBase,
        piece: generateRandomLayout({
          background: genBackground,
          silhouettes,
          keepOutFor: (p) => predictKeepOut(generationBase, size, logoMetrics, p),
          seed,
          size,
          scale: formatScale(size),
          alignment: run.alignment,
          ...style,
        }),
      });
      setError(null);
    } catch (err) {
      // Sem espaço para shapes (ex.: imagem ocupando metade de um banner baixo): a peça sai sem grafismo.
      console.warn(`[${format.label}${side === "verso" ? " · verso" : ""}] ${err instanceof Error ? err.message : String(err)} Peça gerada sem grafismo.`);
      setGenerated({ piece: empty(), for: generationBase });
      setError(null);
    }
  }, [run, silhouettes, logoMetrics, generationBase, size, side, sideKey, format.label, texts.ctaArrow]);

  // Validações de marca: só avisam no console (não bloqueiam geração nem exportação).
  useEffect(() => {
    // Só valida a medição do canvas com os shapes atuais (não a da composição anterior).
    // Nem enquanto o texto ainda está mudando (os shapes se reposicionam depois do debounce).
    if (!layers || !layout || !piece || layout.shapesId !== shapesId(piece) || generated?.for !== base) return;
    const problems = validatePiece(layers, channelsFor(format, ctx), layout, piece).filter((i) => i.result.severity !== "ok");
    // CTA reduzido para caber na coluna ao lado da imagem.
    const baseCta = base.find((l) => l.type === "cta");
    const cta = layers.find((l) => l.type === "cta");
    if (baseCta?.type === "cta" && cta?.type === "cta" && cta.fontSize < baseCta.fontSize * 0.8) {
      problems.push({
        id: "cta-fit",
        label: "CTA reduzido",
        result: {
          valid: true,
          severity: "warning",
          message: `Texto do botão reduzido para ${Math.round((cta.fontSize / baseCta.fontSize) * 100)}% para caber ao lado da imagem; encurte o texto do CTA.`,
        },
      });
    }
    if (problems.length === 0) return;
    console.warn(
      `[Validação de marca] ${format.label} ${format.width}×${format.height}:\n` +
        problems.map((i) => `- ${i.result.severity === "blocking" ? "❌" : "⚠️"} ${i.label}: ${i.result.message}`).join("\n"),
    );
  }, [layers, layout, piece, generated, format, ctx, base]);

  const handleExport = useCallback(
    async (kind: ExportFormat) => {
      if (!stageRef.current) return;
      setExporting(kind);
      try {
        const suffix = ctx.frente === "impresso" && side === "verso" ? "-verso" : "";
        // Material Impresso: PDF em CMYK real (lib/color-cmyk.ts).
        await exportStage(stageRef.current, {
          format: kind,
          baseName: `agibank-${ctx.frente}-${format.id}${suffix}`,
          size,
          cmyk: ctx.midia === "impresso",
        });
      } catch (err) {
        setError(`Falha ao exportar ${kind.toUpperCase()}: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setExporting(null);
      }
    },
    [ctx.frente, ctx.midia, format.id, size, side],
  );

  const previewScale = Math.min(1, PREVIEW_MAX.width / format.width, PREVIEW_MAX.height / format.height);
  const ready = layout !== null && piece !== null;
  const logoLayer = getLogo(base);
  const logoSrc = logoLayer ? logoSrcFor(logoLayer.audience, background, logoLayer.midia) : "";

  return (
    <figure
      className="flex max-w-full flex-col gap-3"
      data-testid={`artboard-${format.id}${side === "verso" ? "-verso" : ""}`}
      data-side={side}
      data-logo-src={logoSrc}
    >
      <figcaption className="flex flex-wrap items-center justify-between gap-2">
        <div className="leading-tight">
          <p className="text-sm font-bold text-agi-blue-dark">
            {format.label}
            {ctx.frente === "impresso" && side === "verso" && " · Verso"}
          </p>
          <p className="text-xs tabular-nums text-slate-500">
            {format.width}×{format.height}px
            {previewScale < 1 && ` · prévia ${Math.round(previewScale * 100)}%`}
            {ctx.midia === "impresso" && " · PDF em CMYK"}
          </p>
        </div>
        <div className="flex gap-1">
          {EXPORT_FORMATS.map(({ format: kind, label }) => (
            <button
              key={kind}
              type="button"
              onClick={() => handleExport(kind)}
              disabled={!ready || exporting !== null}
              aria-label={`Exportar ${format.label}${side === "verso" ? " (verso)" : ""} em ${label}`}
              className="rounded-full border border-agi-blue px-3 py-1 text-xs font-semibold text-agi-blue transition-colors hover:bg-agi-blue hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-agi-blue disabled:cursor-not-allowed disabled:border-agi-gray-border disabled:text-slate-400 disabled:hover:bg-transparent"
            >
              {exporting === kind ? "…" : label}
            </button>
          ))}
        </div>
      </figcaption>
      <div
        className="artboard overflow-hidden rounded-md bg-white shadow-2xl"
        style={{ width: Math.round(format.width * previewScale), aspectRatio: `${format.width} / ${format.height}` }}
      >
        {layers && (
          <DesignCanvas
            width={format.width}
            height={format.height}
            previewScale={previewScale}
            layers={layers}
            shapes={piece}
            stageRef={stageRef}
            imageMask={mask}
            side={side}
            onLayout={setLayout}
          />
        )}
      </div>
      {error && <p className="max-w-xs text-xs text-red-700">{error}</p>}
    </figure>
  );
}
