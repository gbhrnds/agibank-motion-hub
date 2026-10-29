"use client";

import { useEffect, useState } from "react";
import { fontShorthand, type FontWeightKey } from "./brand-tokens";

/** Aguarda o carregamento dos @font-face (gerados de assets-map.json) antes de desenhar no canvas. */
export function useBrandFonts(weights: FontWeightKey[]): boolean {
  const [ready, setReady] = useState(false);
  const key = [...new Set(weights)].sort().join(",");

  useEffect(() => {
    let alive = true;
    setReady(false);
    const list = key ? (key.split(",") as FontWeightKey[]) : [];
    Promise.all(list.map((w) => document.fonts.load(fontShorthand(w, 16))))
      .then((loaded) => {
        loaded.forEach((faces, i) => {
          if (faces.length === 0) console.warn(`Fonte de marca não encontrada para o peso "${list[i]}"`);
        });
      })
      .finally(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, [key]);

  return ready;
}
