"use client";

import Konva from "konva";
import { useCallback, useEffect, useMemo, useState, type MutableRefObject } from "react";
import { Group, Layer as KLayer, Rect as KRect, Stage, Text as KText } from "react-konva";
import { color, fontStack, fontWeight, type FontWeightKey } from "@/lib/brand-tokens";
import { CANVAS_SIZE, getBackground, type Layer, type Rect, type TextLayer } from "@/lib/alerta-spec";
import { GUIDES_LAYER_NAME, type CanvasLayout } from "@/lib/canvas-layout";
import { useBrandFonts } from "@/lib/use-brand-fonts";
import IconInline from "./IconInline";
import LogoSmart, { type LogoMeta } from "./LogoSmart";
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
      case "text":
        return l.trailingIcon ? [`${l.id}:icon`] : [];
      default:
        return [];
    }
  });
}

export default function AlertaCanvas({ layers, stageRef, showGuides, onLayout }: AlertaCanvasProps) {
  const background = getBackground(layers);
  const weights = useMemo(
    () => layers.flatMap((l) => (l.type === "text" ? [l.weight] : [])) as FontWeightKey[],
    [layers],
  );
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
              return fontsReady ? (
                <TextBlock key={layer.id} layer={layer} onIconReady={readyCallbacks[`${layer.id}:icon`]} />
              ) : null;
            case "logo":
              return background ? (
                <LogoSmart key={layer.id} layer={layer} backgroundColor={background.color} onReady={onLogoReady} />
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

function TextBlock({ layer, onIconReady }: { layer: TextLayer; onIconReady?: () => void }) {
  const font = {
    text: layer.text,
    fontSize: layer.fontSize,
    fontFamily: fontStack,
    fontStyle: String(fontWeight(layer.weight)),
    lineHeight: layer.lineHeight,
  };
  const naturalWidth = useMemo(
    () => (layer.trailingIcon ? new Konva.Text(font).width() : 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layer.text, layer.fontSize, layer.weight, layer.lineHeight, layer.trailingIcon],
  );
  const lineBox = layer.fontSize * layer.lineHeight;
  const icon = layer.trailingIcon;

  return (
    <Group name="brand-layer" id={layer.id}>
      <KText
        {...font}
        x={layer.x}
        y={layer.y}
        fill={color(layer.color)}
        wrap="word"
        {...(layer.width !== undefined ? { width: layer.width } : {})}
      />
      {icon && (
        <IconInline
          file={icon.file}
          color={layer.color}
          size={icon.size}
          x={layer.x + naturalWidth + icon.gap}
          y={layer.y + (lineBox - icon.size) / 2}
          onReady={onIconReady}
        />
      )}
    </Group>
  );
}
