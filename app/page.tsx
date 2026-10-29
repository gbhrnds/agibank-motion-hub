"use client";

import type Konva from "konva";
import dynamic from "next/dynamic";
import { useCallback, useMemo, useRef, useState } from "react";
import { GUIDES_LAYER_NAME, type CanvasLayout } from "@/lib/canvas-layout";
import ValidationPanel from "@/components/validation/ValidationPanel";
import { ALERTA_CHANNELS, ALERTA_LAYERS, CANVAS_SIZE, EXPORT_FILE_NAME } from "@/lib/alerta-spec";
import { exportStageToPng } from "@/lib/export-png";
import { validatePiece } from "@/lib/validate-piece";

const AlertaCanvas = dynamic(() => import("@/components/canvas/AlertaCanvas"), { ssr: false });

export default function Page() {
  const stageRef = useRef<Konva.Stage | null>(null);
  const [layout, setLayout] = useState<CanvasLayout | null>(null);
  const [showGuides, setShowGuides] = useState(false);

  const items = useMemo(() => validatePiece(ALERTA_LAYERS, ALERTA_CHANNELS, layout), [layout]);

  const handleExport = useCallback(() => {
    if (!stageRef.current) return;
    exportStageToPng(stageRef.current, {
      fileName: EXPORT_FILE_NAME,
      size: CANVAS_SIZE,
      hideNames: [GUIDES_LAYER_NAME],
    });
  }, []);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 p-6 lg:p-10">
      <header>
        <h1 className="text-2xl font-extrabold">Agibank Brand Studio</h1>
        <p className="text-slate-600">Alerta institucional · Comunicação Interna · 600×600 (Alerta Sempre Juntos / Alerta Teams)</p>
      </header>
      <div className="flex flex-col items-start gap-6 lg:flex-row">
        <div
          className="shrink-0 overflow-hidden rounded-lg shadow-lg"
          style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}
          data-testid="canvas-wrapper"
        >
          <AlertaCanvas layers={ALERTA_LAYERS} stageRef={stageRef} showGuides={showGuides} onLayout={setLayout} />
        </div>
        <ValidationPanel
          items={items}
          ready={layout !== null}
          onExport={handleExport}
          showGuides={showGuides}
          onToggleGuides={setShowGuides}
        />
      </div>
    </main>
  );
}
