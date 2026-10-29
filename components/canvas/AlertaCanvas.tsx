"use client";

import type Konva from "konva";
import { useCallback, useEffect, useMemo, useState, type MutableRefObject } from "react";
import { Group, Layer as KLayer, Rect as KRect, Stage } from "react-konva";
import { color, type FontWeightKey } from "@/lib/brand-tokens";
import { CANVAS_SIZE, getBackground, type Layer, type Point, type Rect } from "@/lib/alerta-spec";
import { GUIDES_LAYER_NAME, type CanvasLayout } from "@/lib/canvas-layout";
import { ctaGeometry, type CtaGeometry } from "@/lib/cta-geometry";
import { useBrandFonts } from "@/lib/use-brand-fonts";
import ConnectorLine from "./ConnectorLine";
import CtaPill from "./CtaPill";
import IconInline from "./IconInline";
import LogoSmart, { type LogoMeta } from "./LogoSmart";
import RichText from "./RichText";
import ShapeDecor from "./ShapeDecor";

interface AlertaCanvasProps {
  layers: Layer[];
  stageRef: MutableRefObject<Konva.Stage | null>;
  showGuides: boolean;
  onLayout: (layout: CanvasLayout | null) => void;
}

/** Ids dos assets assíncronos que precisam carregar antes de medir/exportar. */
function assetIds(layers: Layer[]): string[] {
  return layers.flatMap((l) => {
    switch (l.type) {
      case "shape":
      case "logo":
        return [l.id];
      case "icons":
        return l.icons.map((_, i) => `${l.id}:${i}`);
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

/** Caixas conhecidas antes do render (para ancorar o conector). */
function anchorBoxes(layers: Layer[], ctas: Record<string, CtaGeometry>): Record<string, Rect> {
  const boxes: Record<string, Rect> = {};
  for (const l of layers) {
    if (l.type === "icons") {
      boxes[l.id] = { x: l.x, y: l.y, width: l.icons.length * l.size + (l.icons.length - 1) * l.gap, height: l.size };
    } else if (l.type === "cta" && ctas[l.id]) {
      boxes[l.id] = ctas[l.id].box;
    }
  }
  return boxes;
}

const rightCenter = (r: Rect, offset: number): Point => ({ x: r.x + r.width + offset, y: r.y + r.height / 2 });

export default function AlertaCanvas({ layers, stageRef, showGuides, onLayout }: AlertaCanvasProps) {
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
    assetIds(layers).forEach((id) => (map[id] = () => markLoaded(id)));
    return map;
  }, [layers, markLoaded]);
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
  const anchors = useMemo(() => anchorBoxes(layers, ctas), [layers, ctas]);

  const allReady = fontsReady && assetIds(layers).every((id) => loaded[id]);

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
      stage.find(".brand-layer").forEach((node) => {
        bounds[node.id()] = node.getClientRect({ relativeTo: stage });
      });
      const logo = logoId ? bounds[logoId] : undefined;
      const pad = logoMeta?.clearSpace ?? null;
      const zone =
        logo && pad !== null
          ? { x: logo.x - pad, y: logo.y - pad, width: logo.width + pad * 2, height: logo.height + pad * 2 }
          : null;
      setClearZone(zone);
      onLayout({ bounds, logoClearZone: zone });
    });
    return () => cancelAnimationFrame(raf);
  }, [allReady, layers, logoId, logoMeta, onLayout, stageRef]);

  return (
    <Stage width={CANVAS_SIZE} height={CANVAS_SIZE} ref={stageRef}>
      <KLayer listening={false}>
        {layers.map((layer) => {
          switch (layer.type) {
            case "background":
              return (
                <KRect key={layer.id} x={0} y={0} width={CANVAS_SIZE} height={CANVAS_SIZE} fill={color(layer.color)} />
              );
            case "shape":
              return <ShapeDecor key={layer.id} layer={layer} onReady={readyCallbacks[layer.id]} />;
            case "icons":
              return (
                <Group key={layer.id} name="brand-layer" id={layer.id}>
                  {layer.icons.map((file, i) => (
                    <IconInline
                      key={file}
                      file={file}
                      color={layer.color}
                      size={layer.size}
                      x={layer.x + i * (layer.size + layer.gap)}
                      y={layer.y}
                      onReady={readyCallbacks[`${layer.id}:${i}`]}
                    />
                  ))}
                </Group>
              );
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
            case "connector": {
              const from = anchors[layer.from];
              const to = anchors[layer.to];
              return from && to ? (
                <ConnectorLine
                  key={layer.id}
                  layer={layer}
                  start={rightCenter(from, layer.offset)}
                  end={rightCenter(to, layer.offset)}
                />
              ) : null;
            }
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
