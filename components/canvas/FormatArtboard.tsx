"use client";

import type Konva from "konva";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CanvasLayout } from "@/lib/canvas-layout";
import { exportStage, type ExportFormat } from "@/lib/export";
import { channelsFor, type FormatSpec, type PieceContext } from "@/lib/format-config";
import { logoMetricsFrom, predictKeepOut, type LogoMetrics } from "@/lib/keep-out";
import { generateRandomLayout, type PieceLayout, type PieceRun } from "@/lib/layout-engine";
import { buildLayers, formatScale, getBackground, type Layer } from "@/lib/piece-spec";
import { composeLayers } from "@/lib/piece-style";
import type { Silhouette } from "@/lib/shape-silhouette";
import { useBrandFonts } from "@/lib/use-brand-fonts";
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
export default function FormatArtboard({ format, ctx, run, silhouettes }: FormatArtboardProps) {
  const size = useMemo(() => ({ width: format.width, height: format.height }), [format.width, format.height]);
  const base = useMemo(() => buildLayers(size, ctx), [size, ctx]);
  const background = getBackground(base)!.color;
  const fontsReady = useBrandFonts(useMemo(() => fontWeightsUsed(base), [base]));

  const stageRef = useRef<Konva.Stage | null>(null);
  const [layout, setLayout] = useState<CanvasLayout | null>(null);
  const [logoMetrics, setLogoMetrics] = useState<LogoMetrics | null>(null);
  const [piece, setPiece] = useState<PieceLayout | null>(null);
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

  // Cada novo desdobramento gera shapes para este formato com o estado global sorteado.
  useEffect(() => {
    if (!run || !silhouettes || !logoMetrics) return;
    try {
      setPiece(
        generateRandomLayout({
          background,
          silhouettes,
          keepOutFor: (p) => predictKeepOut(base, size, logoMetrics, p),
          seed: seedFor(run, format.id),
          size,
          scale: formatScale(size),
          alignment: run.alignment,
          ctaStyle: run.ctaStyle,
          ctaColor: run.ctaColor,
          palette: run.palette,
          preferArchetype: run.archetype,
        }),
      );
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[${format.label}] ${message}`);
      setError(message);
    }
  }, [run, silhouettes, logoMetrics, background, base, size, format.id, format.label]);

  // Validações de marca: só avisam no console (não bloqueiam geração nem exportação).
  useEffect(() => {
    // Só valida a medição do canvas com os shapes atuais (não a da composição anterior).
    if (!layers || !layout || !piece || layout.shapesSeed !== piece.seed) return;
    const problems = validatePiece(layers, channelsFor(format, ctx), layout, piece).filter((i) => i.result.severity !== "ok");
    if (problems.length === 0) return;
    console.warn(
      `[Validação de marca] ${format.label} ${format.width}×${format.height}:\n` +
        problems.map((i) => `- ${i.result.severity === "blocking" ? "❌" : "⚠️"} ${i.label}: ${i.result.message}`).join("\n"),
    );
  }, [layers, layout, piece, format, ctx]);

  const handleExport = useCallback(
    async (kind: ExportFormat) => {
      if (!stageRef.current) return;
      setExporting(kind);
      try {
        await exportStage(stageRef.current, { format: kind, baseName: `agibank-${ctx.frente}-${format.id}`, size });
      } catch (err) {
        setError(`Falha ao exportar ${kind.toUpperCase()}: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setExporting(null);
      }
    },
    [ctx.frente, format.id, size],
  );

  const previewScale = Math.min(1, PREVIEW_MAX.width / format.width, PREVIEW_MAX.height / format.height);
  const ready = layout !== null && piece !== null;

  return (
    <figure className="flex max-w-full flex-col gap-3" data-testid={`artboard-${format.id}`}>
      <figcaption className="flex flex-wrap items-center justify-between gap-2">
        <div className="leading-tight">
          <p className="text-sm font-bold text-agi-blue-dark">{format.label}</p>
          <p className="text-xs tabular-nums text-slate-500">
            {format.width}×{format.height}px
            {previewScale < 1 && ` · prévia ${Math.round(previewScale * 100)}%`}
          </p>
        </div>
        <div className="flex gap-1">
          {EXPORT_FORMATS.map(({ format: kind, label }) => (
            <button
              key={kind}
              type="button"
              onClick={() => handleExport(kind)}
              disabled={!ready || exporting !== null}
              aria-label={`Exportar ${format.label} em ${label}`}
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
            onLayout={setLayout}
          />
        )}
      </div>
      {error && <p className="max-w-xs text-xs text-red-700">{error}</p>}
    </figure>
  );
}
