"use client";

import type Konva from "konva";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ValidationPanel from "@/components/validation/ValidationPanel";
import { ALERTA_CHANNELS, ALERTA_LAYERS, CANVAS_SIZE, EXPORT_FILE_NAME } from "@/lib/alerta-spec";
import { shapePath } from "@/lib/brand-tokens";
import { GUIDES_LAYER_NAME, type CanvasLayout } from "@/lib/canvas-layout";
import { archetype } from "@/lib/composition-tokens";
import { exportStageToPng } from "@/lib/export-png";
import { keepOutZones } from "@/lib/keep-out";
import { allShapeFiles, generateRandomLayout, type GeneratedLayout, type KeepOutZone } from "@/lib/layout-engine";
import { loadSilhouette, type Silhouette } from "@/lib/shape-silhouette";
import { validatePiece } from "@/lib/validate-piece";

const AlertaCanvas = dynamic(() => import("@/components/canvas/AlertaCanvas"), { ssr: false });

export default function Page() {
  const stageRef = useRef<Konva.Stage | null>(null);
  const [layout, setLayout] = useState<CanvasLayout | null>(null);
  const [showGuides, setShowGuides] = useState(false);
  const [shapes, setShapes] = useState<GeneratedLayout | null>(null);
  const [silhouettes, setSilhouettes] = useState<Record<string, Silhouette> | null>(null);
  const [keepOut, setKeepOut] = useState<KeepOutZone[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Silhuetas de todos os shapes do assets-map.json (usadas pelo motor para evitar textos e logo).
  useEffect(() => {
    Promise.all(allShapeFiles.map((f) => loadSilhouette(f, shapePath(f))))
      .then((list) => setSilhouettes(Object.fromEntries(list.map((s) => [s.file, s]))))
      .catch((err) => setError(String(err)));
  }, []);

  // Textos, CTA e área do logo não dependem dos grafismos: guardamos a última medição.
  useEffect(() => {
    if (layout) setKeepOut(keepOutZones(ALERTA_LAYERS, layout));
  }, [layout]);

  const generate = useCallback(() => {
    if (!silhouettes || !keepOut) return;
    try {
      setShapes(generateRandomLayout({ keepOut, silhouettes }));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [silhouettes, keepOut]);

  // Primeira composição assim que o canvas foi medido.
  useEffect(() => {
    if (!shapes && silhouettes && keepOut) generate();
  }, [shapes, silhouettes, keepOut, generate]);

  const items = useMemo(() => validatePiece(ALERTA_LAYERS, ALERTA_CHANNELS, layout, shapes), [layout, shapes]);

  const handleExport = useCallback(() => {
    if (!stageRef.current) return;
    exportStageToPng(stageRef.current, {
      fileName: EXPORT_FILE_NAME,
      size: CANVAS_SIZE,
      hideNames: [GUIDES_LAYER_NAME],
    });
  }, []);

  const canGenerate = !!silhouettes && !!keepOut;

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
            <p className="text-sm text-slate-600" data-testid="archetype">
              {shapes
                ? `${archetype(shapes.archetype).name} · ${shapes.combo.join(" + ")} · seed ${shapes.seed}`
                : canGenerate
                  ? "Gerando…"
                  : "Carregando shapes…"}
            </p>
          </div>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <div
            className="shrink-0 overflow-hidden rounded-lg shadow-lg"
            style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}
            data-testid="canvas-wrapper"
          >
            <AlertaCanvas
              layers={ALERTA_LAYERS}
              shapes={shapes}
              stageRef={stageRef}
              showGuides={showGuides}
              onLayout={setLayout}
            />
          </div>
        </div>
        <ValidationPanel
          items={items}
          ready={layout !== null && shapes !== null}
          onExport={handleExport}
          showGuides={showGuides}
          onToggleGuides={setShowGuides}
        />
      </div>
    </main>
  );
}
