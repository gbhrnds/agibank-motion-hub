"use client";

import type Konva from "konva";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ValidationPanel from "@/components/validation/ValidationPanel";
import { ALERTA_CHANNELS, ALERTA_LAYERS, CANVAS_SIZE, EXPORT_FILE_NAME, getBackground } from "@/lib/alerta-spec";
import { shapePath } from "@/lib/brand-tokens";
import { GUIDES_LAYER_NAME, type CanvasLayout } from "@/lib/canvas-layout";
import { archetype, ctaVariant } from "@/lib/composition-tokens";
import { exportStageToPng } from "@/lib/export-png";
import { logoMetricsFrom, predictKeepOut, type LogoMetrics } from "@/lib/keep-out";
import { allShapeFiles, generateRandomLayout, type PieceLayout } from "@/lib/layout-engine";
import { applyPieceStyle } from "@/lib/piece-style";
import { loadSilhouette, type Silhouette } from "@/lib/shape-silhouette";
import { validatePiece } from "@/lib/validate-piece";

const AlertaCanvas = dynamic(() => import("@/components/canvas/AlertaCanvas"), { ssr: false });

const BACKGROUND = getBackground(ALERTA_LAYERS)!.color;

export default function Page() {
  const stageRef = useRef<Konva.Stage | null>(null);
  const [layout, setLayout] = useState<CanvasLayout | null>(null);
  const [showGuides, setShowGuides] = useState(false);
  const [piece, setPiece] = useState<PieceLayout | null>(null);
  const [silhouettes, setSilhouettes] = useState<Record<string, Silhouette> | null>(null);
  const [logoMetrics, setLogoMetrics] = useState<LogoMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const handleExport = useCallback(() => {
    if (!stageRef.current) return;
    exportStageToPng(stageRef.current, {
      fileName: EXPORT_FILE_NAME,
      size: CANVAS_SIZE,
      hideNames: [GUIDES_LAYER_NAME],
    });
  }, []);

  const canGenerate = !!silhouettes && !!logoMetrics;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 p-6 lg:p-10">
      <header>
        <h1 className="text-2xl font-extrabold">Agibank Brand Studio</h1>
        <p className="text-slate-600">Alerta institucional · Comunicação Interna · 600×600 (Alerta Sempre Juntos / Alerta Teams)</p>
      </header>
      <div className="flex flex-col items-start gap-6 lg:flex-row">
        <div className="flex w-full max-w-[600px] shrink-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={generate}
              disabled={!canGenerate}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-900 shadow-sm transition hover:border-brand-azulAgibank hover:text-brand-azulAgibank disabled:cursor-not-allowed disabled:opacity-50"
            >
              🎲 Gerar Nova Composição
            </button>
            {!piece && <p className="text-sm text-slate-600">{canGenerate ? "Gerando…" : "Carregando shapes…"}</p>}
          </div>
          {piece && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-slate-600 sm:grid-cols-4" data-testid="piece-state">
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">Alinhamento</dt>
                <dd>{piece.alignment === "center" ? "Centralizado" : "Esquerda"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">CTA</dt>
                <dd>{ctaVariant(piece.ctaStyle).name}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">Shapes</dt>
                <dd>{archetype(piece.shapeArchetype).name.replace(/\s*\(.*\)/, "")}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">Paleta</dt>
                <dd>{piece.shapePalette.name}</dd>
              </div>
            </dl>
          )}
          {error && <p className="text-sm text-red-700">{error}</p>}
          <div
            className="shrink-0 overflow-hidden rounded-lg shadow-lg"
            style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}
            data-testid="canvas-wrapper"
          >
            <AlertaCanvas layers={layers} shapes={piece} stageRef={stageRef} showGuides={showGuides} onLayout={setLayout} />
          </div>
          {piece && <p className="text-xs text-slate-400">seed {piece.seed}</p>}
        </div>
        <ValidationPanel
          items={items}
          ready={layout !== null && piece !== null}
          onExport={handleExport}
          showGuides={showGuides}
          onToggleGuides={setShowGuides}
        />
      </div>
    </main>
  );
}
