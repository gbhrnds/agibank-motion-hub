"use client";

import type Konva from "konva";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ValidationPanel from "@/components/validation/ValidationPanel";
import { ALERTA_CHANNELS, ALERTA_LAYERS, CANVAS_SIZE, EXPORT_BASE_NAME, getBackground } from "@/lib/alerta-spec";
import { logoPath, pickLogoKey, shapePath } from "@/lib/brand-tokens";
import { GUIDES_LAYER_NAME, type CanvasLayout } from "@/lib/canvas-layout";
import { archetype, ctaVariant } from "@/lib/composition-tokens";
import { exportStage, type ExportFormat } from "@/lib/export";
import { logoMetricsFrom, predictKeepOut, type LogoMetrics } from "@/lib/keep-out";
import { allShapeFiles, generateRandomLayout, type PieceLayout } from "@/lib/layout-engine";
import { applyPieceStyle } from "@/lib/piece-style";
import { loadSilhouette, type Silhouette } from "@/lib/shape-silhouette";
import { validatePiece } from "@/lib/validate-piece";

const AlertaCanvas = dynamic(() => import("@/components/canvas/AlertaCanvas"), { ssr: false });

const BACKGROUND = getBackground(ALERTA_LAYERS)!.color;
/** Logo da interface: Agi reduzido (uso interno), versão positiva sobre o branco da barra lateral. */
const UI_LOGO = logoPath(pickLogoKey("interno", "fundoBranco", "digital"));
const EXPORT_FORMATS: { format: ExportFormat; label: string }[] = [
  { format: "png", label: "PNG" },
  { format: "jpg", label: "JPG" },
  { format: "pdf", label: "PDF" },
];

export default function Page() {
  const stageRef = useRef<Konva.Stage | null>(null);
  const [layout, setLayout] = useState<CanvasLayout | null>(null);
  const [showGuides, setShowGuides] = useState(false);
  const [piece, setPiece] = useState<PieceLayout | null>(null);
  const [silhouettes, setSilhouettes] = useState<Record<string, Silhouette> | null>(null);
  const [logoMetrics, setLogoMetrics] = useState<LogoMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);

  // Camadas da peça com o alinhamento e o estilo de CTA da composição atual.
  const layers = useMemo(() => (piece ? applyPieceStyle(ALERTA_LAYERS, piece) : ALERTA_LAYERS), [piece]);

  // Silhuetas de todos os shapes do assets-map.json (usadas pelo motor para evitar textos e logo).
  useEffect(() => {
    Promise.all(allShapeFiles.map((f) => loadSilhouette(f, shapePath(f))))
      .then((list) => setSilhouettes(Object.fromEntries(list.map((s) => [s.file, s]))))
      .catch((err) => setError(String(err)));
  }, []);

  // Tamanho do logo e da área de proteção: medidos uma vez no canvas.
  useEffect(() => {
    if (layout && !logoMetrics) setLogoMetrics(logoMetricsFrom(layers, layout));
  }, [layout, layers, logoMetrics]);

  const generate = useCallback(() => {
    if (!silhouettes || !logoMetrics) return;
    try {
      setPiece(
        generateRandomLayout({
          background: BACKGROUND,
          silhouettes,
          keepOutFor: (p) => predictKeepOut(ALERTA_LAYERS, logoMetrics, p),
        }),
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [silhouettes, logoMetrics]);

  // Primeira composição assim que o canvas foi medido.
  useEffect(() => {
    if (!piece && silhouettes && logoMetrics) generate();
  }, [piece, silhouettes, logoMetrics, generate]);

  const items = useMemo(() => validatePiece(layers, ALERTA_CHANNELS, layout, piece), [layers, layout, piece]);
  const ready = layout !== null && piece !== null;
  const blocked = items.some((i) => i.result.severity === "blocking");
  const exportDisabled = !ready || blocked || exporting !== null;

  const handleExport = useCallback(async (format: ExportFormat) => {
    if (!stageRef.current) return;
    setExporting(format);
    try {
      await exportStage(stageRef.current, { format, baseName: EXPORT_BASE_NAME, size: CANVAS_SIZE, hideNames: [GUIDES_LAYER_NAME] });
    } catch (err) {
      setError(`Falha ao exportar ${format.toUpperCase()}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setExporting(null);
    }
  }, []);

  const canGenerate = !!silhouettes && !!logoMetrics;

  return (
    <div className="flex w-full flex-col overflow-hidden bg-agi-gray-bg font-sans lg:h-screen lg:flex-row">
      <aside className="z-10 order-2 flex w-full flex-col border-agi-gray-border bg-white shadow-lg lg:order-none lg:w-96 lg:border-r">
        <header className="flex items-center gap-3 border-b border-agi-gray-border px-6 py-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={UI_LOGO} alt="agi" className="h-7 w-auto" />
          <div className="leading-tight">
            <h1 className="text-lg font-extrabold text-agi-blue-dark">Brand Studio</h1>
            <p className="text-xs text-slate-500">Alerta institucional · 600×600</p>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
          <button
            type="button"
            onClick={generate}
            disabled={!canGenerate}
            className="w-full rounded-full bg-agi-green px-6 py-3 text-lg font-bold text-agi-blue-dark shadow-md transition-colors hover:bg-agi-green-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-agi-blue disabled:cursor-not-allowed disabled:opacity-50"
          >
            🎲 Gerar Nova Composição
          </button>

          {piece ? (
            <dl className="grid grid-cols-2 gap-2 text-sm" data-testid="piece-state">
              {[
                ["Alinhamento", piece.alignment === "center" ? "Centralizado" : "Esquerda"],
                ["CTA", ctaVariant(piece.ctaStyle).name],
                ["Shapes", archetype(piece.shapeArchetype).name.replace(/\s*\(.*\)/, "")],
                ["Paleta", piece.shapePalette.name],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-agi-gray-bg px-3 py-2">
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{k}</dt>
                  <dd className="font-semibold text-agi-blue-dark">{v}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-slate-500">{canGenerate ? "Gerando composição…" : "Carregando shapes…"}</p>
          )}
          {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

          <ValidationPanel items={items} ready={ready} />

          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              id="show-guides"
              type="checkbox"
              className="h-4 w-4 accent-agi-blue"
              checked={showGuides}
              onChange={(e) => setShowGuides(e.target.checked)}
            />
            Mostrar área de proteção do logo
          </label>
        </div>

        <footer className="border-t border-agi-gray-border px-6 py-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Exportar</p>
          <div className="flex gap-2">
            {EXPORT_FORMATS.map(({ format, label }) => (
              <button
                key={format}
                type="button"
                onClick={() => handleExport(format)}
                disabled={exportDisabled}
                aria-label={`Exportar ${label}`}
                className="flex-1 rounded-full border-2 border-agi-blue px-4 py-2 text-sm font-semibold text-agi-blue transition-colors hover:bg-agi-blue hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-agi-blue disabled:cursor-not-allowed disabled:border-agi-gray-border disabled:text-slate-400 disabled:hover:bg-transparent"
              >
                {exporting === format ? "…" : label}
              </button>
            ))}
          </div>
          {blocked && <p className="mt-2 text-xs text-red-700">Corrija os itens que bloqueiam para liberar a exportação.</p>}
        </footer>
      </aside>

      <main className="relative order-1 flex flex-1 items-center justify-center p-4 sm:p-6 lg:order-none lg:p-10">
        <div className="flex w-full flex-col items-center gap-3">
          <div
            className="artboard overflow-hidden rounded-md bg-white shadow-2xl"
            style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}
            data-testid="canvas-wrapper"
          >
            <AlertaCanvas layers={layers} shapes={piece} stageRef={stageRef} showGuides={showGuides} onLayout={setLayout} />
          </div>
          {piece && <p className="text-xs tabular-nums text-slate-400">seed {piece.seed}</p>}
        </div>
      </main>
    </div>
  );
}
