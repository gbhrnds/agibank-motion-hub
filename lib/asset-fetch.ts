import { localMirror } from "./brand-tokens";

/**
 * Busca um asset pela URL da CDN (meta.cdnBase); se a CDN não responder, tenta a cópia local.
 * Só aceita URLs http(s)/relativas — nunca data: (o sandbox do Artifact bloqueia fetch de data URLs).
 */
export async function fetchAssetText(src: string): Promise<string> {
  const candidates = [src, localMirror(src)].filter((u): u is string => !!u);
  let lastError: unknown = null;
  for (const url of candidates) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.text();
      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(`Falha ao carregar ${src}: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}
