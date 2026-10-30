"use client";

import type Konva from "konva";
import { useCallback, useEffect, useMemo, useState, type MutableRefObject } from "react";
import { Group, Layer as KLayer, Rect as KRect, Stage } from "react-konva";
import { color, type FontWeightKey } from "@/lib/brand-tokens";
import { CANVAS_SIZE, getBackground, type Layer, type Rect } from "@/lib/alerta-spec";
import { GUIDES_LAYER_NAME, type CanvasLayout } from "@/lib/canvas-layout";
import { measureColorCoverage } from "@/lib/color-coverage";
import { ctaGeometry, type CtaGeometry } from "@/lib/cta-geometry";
import type { PieceLayout } from "@/lib/layout-engine";
import { useBrandFonts } from "@/lib/use-brand-fonts";
import CtaPill from "./CtaPill";
import LogoSmart, { type LogoMeta } from "./LogoSmart";
import RichText from "./RichText";
import ShapeCluster from "./ShapeCluster";

interface AlertaCanvasProps {
  layers: Layer[];
  /** Grafismos gerados pelo motor (null = ainda não gerados). */
  shapes: PieceLayout | null;
  stageRef: MutableRefObject<Konva.Stage | null>;
  showGuides: boolean;
  onLayout: (layout: CanvasLayout | null) => void;
}

/** Id de carregamento dos grafismos: muda a cada layout gerado. */
const shapesLoadId = (layerId: string, shapes: PieceLayout | null) => `${layerId}:${shapes?.seed ?? "none"}`;

/** Ids dos assets assíncronos que precisam carregar antes de medir/exportar. */
function assetIds(layers: Layer[], shapes: PieceLayout | null): string[] {
  return layers.flatMap((l) => {
    switch (l.type) {
      case "shapes":
        // Sem grafismo gerado ainda, o canvas mede só textos/CTA/logo (o motor precisa dessa medição).
        return shapes ? [shapesLoadId(l.id, shapes)] : [];
      case "logo":
        return [l.id];
      case "cta":
        return l.trailingIcon ? [`${l.id}:icon`] : [];
      default:
        return [];
    }
  });
}

function fontWeightsUsed(layers: Layer[]): FontWeightKey[] {
  return layers.flatMap((l) => {
    if (l.type === "text") return l.highlight ? [l.weight, l.highlight.weight] : [l.weight];
    if (l.type === "cta") return [l.weight];
    return [];
  });
}

export default function AlertaCanvas({ layers, shapes, stageRef, showGuides, onLayout }: AlertaCanvasProps) {
  const background = getBackground(layers);
  const weights = useMemo(() => fontWeightsUsed(layers), [layers]);
  const fontsReady = useBrandFonts(weights);

  const [loaded, setLoaded] = useState<Record<string, true>>({});
  const [logoMeta, setLogoMeta] = useState<LogoMeta | null>(null);
  const [clearZone, setClearZone] = useState<Rect | null>(null);

  const markLoaded = useCallback((id: string) => {
    setLoaded((prev) => (prev[id] ? prev : { ...prev, [id]: true }));
  }, []);
  const readyCallbacks = useMemo(() => {
    const map: Record<string, () => void> = {};
    assetIds(layers, shapes).forEach((id) => (map[id] = () => markLoaded(id)));
    return map;
  }, [layers, shapes, markLoaded]);
  const logoId = layers.find((l) => l.type === "logo")?.id;
  const onLogoReady = useCallback(
    (meta: LogoMeta) => {
      setLogoMeta(meta);
      if (logoId) markLoaded(logoId);
    },
    [logoId, markLoaded],
  );

  // Geometria que depende da fonte carregada (largura do texto do CTA).
  const ctas = useMemo(() => {
    const map: Record<string, CtaGeometry> = {};
    if (fontsReady) for (const l of layers) if (l.type === "cta") map[l.id] = ctaGeometry(l);
    return map;
  }, [fontsReady, layers]);

  const allReady = fontsReady && assetIds(layers, shapes).every((id) => loaded[id]);

  // Mede o layout real renderizado pelo Konva (usado pela validação de área de proteção).
  useEffect(() => {
    if (!allReady) {
      onLayout(null);
      return;
    }
    const raf = requestAnimationFrame(() => {
      const stage = stageRef.current;
      if (!stage) return;
      const bounds: Record<string, Rect> = {};
      stage.find(".brand-layer, .cluster-item").forEach((node) => {
        bounds[node.id()] = node.getClientRect({ relativeTo: stage });
      });
      const logo = logoId ? bounds[logoId] : undefined;
      const pad = logoMeta?.clearSpace ?? null;
      const zone =
        logo && pad !== null
          ? { x: logo.x - pad, y: logo.y - pad, width: logo.width + pad * 2, height: logo.height + pad * 2 }
          : null;
      setClearZone(zone);
      onLayout({
        bounds,
        logoClearZone: zone,
        colorCoverage: measureColorCoverage(stage, CANVAS_SIZE, [GUIDES_LAYER_NAME]),
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [allReady, shapes, layers, logoId, logoMeta, onLayout, stageRef]);

  return (
    <Stage width={CANVAS_SIZE} height={CANVAS_SIZE} ref={stageRef}>
      <KLayer listening={false}>
        {layers.map((layer) => {
          switch (layer.type) {
            case "background":
              return (
                <KRect key={layer.id} x={0} y={0} width={CANVAS_SIZE} height={CANVAS_SIZE} fill={color(layer.color)} />
              );
            case "shapes":
              return shapes ? (
                <ShapeCluster
                  key={shapesLoadId(layer.id, shapes)}
                  id={layer.id}
                  layout={shapes}
                  onReady={readyCallbacks[shapesLoadId(layer.id, shapes)]}
                />
              ) : null;
            case "text":
              return fontsReady ? <RichText key={layer.id} layer={layer} /> : null;
            case "cta":
              return ctas[layer.id] ? (
                <CtaPill
                  key={layer.id}
                  layer={layer}
                  geometry={ctas[layer.id]}
                  onIconReady={readyCallbacks[`${layer.id}:icon`]}
                />
              ) : null;
            case "logo":
              return background ? (
                <LogoSmart
                  key={layer.id}
                  audience={layer.audience}
                  layer={layer}
                  backgroundColor={background.color}
                  onReady={onLogoReady}
                />
              ) : null;
          }
        })}
      </KLayer>
      <KLayer name={GUIDES_LAYER_NAME} listening={false} visible={showGuides}>
        {clearZone && (
          <KRect
            {...clearZone}
            stroke={color("verde")}
            strokeWidth={1}
            dash={[4, 4]}
            fill={color("verde")}
            opacity={0.25}
          />
        )}
      </KLayer>
    </Stage>
  );
}
