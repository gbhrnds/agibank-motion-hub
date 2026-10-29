"use client";

import { useEffect, useState } from "react";
import { loadSvgAsset, type SvgAsset, type SvgAssetOptions } from "./svg-asset";

export function useSvgAsset(src: string, { fill, referenceFill }: SvgAssetOptions = {}): SvgAsset | null {
  const [asset, setAsset] = useState<SvgAsset | null>(null);

  useEffect(() => {
    let alive = true;
    setAsset(null);
    loadSvgAsset(src, { fill, referenceFill })
      .then((a) => alive && setAsset(a))
      .catch((err) => console.error(err));
    return () => {
      alive = false;
    };
  }, [src, fill, referenceFill]);

  return asset;
}
