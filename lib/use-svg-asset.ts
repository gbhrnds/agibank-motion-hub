"use client";

import { useEffect, useState } from "react";
import { loadSvgAsset, type SvgAsset, type SvgAssetOptions } from "./svg-asset";

export function useSvgAsset(src: string, options: SvgAssetOptions = {}): SvgAsset | null {
  const [asset, setAsset] = useState<SvgAsset | null>(null);
  const key = JSON.stringify(options);

  useEffect(() => {
    let alive = true;
    setAsset(null);
    loadSvgAsset(src, JSON.parse(key) as SvgAssetOptions)
      .then((a) => alive && setAsset(a))
      .catch((err) => console.error(err));
    return () => {
      alive = false;
    };
  }, [src, key]);

  return asset;
}

/** Carrega vários SVGs; devolve null até todos estarem prontos. */
export function useSvgAssets(requests: { src: string; options?: SvgAssetOptions }[]): SvgAsset[] | null {
  const [assets, setAssets] = useState<SvgAsset[] | null>(null);
  const key = JSON.stringify(requests);

  useEffect(() => {
    let alive = true;
    setAssets(null);
    const list = JSON.parse(key) as { src: string; options?: SvgAssetOptions }[];
    Promise.all(list.map((r) => loadSvgAsset(r.src, r.options)))
      .then((a) => alive && setAssets(a))
      .catch((err) => console.error(err));
    return () => {
      alive = false;
    };
  }, [key]);

  return assets;
}
