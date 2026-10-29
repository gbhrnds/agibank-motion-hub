"use client";

import { Group, Line } from "react-konva";
import { color } from "@/lib/brand-tokens";
import type { ConnectorLayer, Point } from "@/lib/alerta-spec";

interface ConnectorLineProps {
  layer: ConnectorLayer;
  start: Point;
  end: Point;
}

/** Linha conectora orgânica (stroke fino, sem fill) — composition-patterns.json → "linha-conectora-organica". */
export default function ConnectorLine({ layer, start, end }: ConnectorLineProps) {
  const points = [start, ...layer.via, end].flatMap((p) => [p.x, p.y]);
  return (
    <Group name="brand-layer" id={layer.id}>
      <Line
        points={points}
        stroke={color(layer.color)}
        strokeWidth={layer.strokeWidth}
        tension={layer.tension}
        lineCap="round"
        lineJoin="round"
      />
    </Group>
  );
}
