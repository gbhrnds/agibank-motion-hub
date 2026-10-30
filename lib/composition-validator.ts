import type { Layer, Rect, ShapeClusterLayer } from "./alerta-spec";
import type { ClusterReport } from "./cluster-geometry";
import { clusterPresetIds, clusterSizeRange, composition, ctaVariantNames } from "./composition-tokens";
import type { ValidationResult } from "./contrast-validator";
import { breakText, forbiddenTrailingWords, hasHighlight } from "./rich-text";
import { pieceSize, presetPieces } from "./shape-presets";
import { normalizeWord } from "./text-wrap";

/** Regras de config/composition-patterns.json. Regras "never*" e o mosaico sem sobreposição bloqueiam. */

const block = (message: string): ValidationResult => ({ valid: false, severity: "blocking", message });
const warn = (message: string): ValidationResult => ({ valid: true, severity: "warning", message });
const ok = (message: string): ValidationResult => ({ valid: true, severity: "ok", message });

const intersects = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** textHierarchyRules.neverSingleColor: o bloco de texto combina pelo menos 2 cores. */
export function validateTextHierarchy(layers: Layer[]): ValidationResult {
  const colors = new Set<string>();
  for (const l of layers) {
    if (l.type !== "text") continue;
    colors.add(l.color);
    if (l.highlight && hasHighlight(l.text)) colors.add(l.highlight.color);
  }
  if (composition.textHierarchyRules.neverSingleColor && colors.size < 2) {
    return block(`Texto monocromático (${[...colors].join(", ")}). Use ao menos 2 cores: título bicolor ou palavra-chave destacada.`);
  }
  return ok(`Texto em ${colors.size} cores: ${[...colors].join(" + ")}.`);
}

/** ctaRules.variants "pill-solid-accent": "Pílula verde ou amarela, texto azul escuro". */
const ACCENT_PILL_COLORS = ["verde", "amarelo"];

/** ctaRules: nunca texto solto; pílula só na variante existente (verde/amarela). */
export function validateCtaStyle(layers: Layer[]): ValidationResult {
  const ctas = layers.filter((l) => l.type === "cta");
  if (ctas.length === 0) return warn("A peça não tem CTA.");
  for (const cta of ctas) {
    if (cta.type !== "cta") continue;
    if (!cta.pill) {
      if (composition.ctaRules.neverPlainText) return block(`${cta.label} como texto solto. Use pílula ou caixa sólida.`);
      continue;
    }
    if (!ACCENT_PILL_COLORS.includes(cta.pill.color) || !ctaVariantNames.includes("pill-solid-accent")) {
      return block(
        `Pílula ${cta.pill.color} não corresponde a nenhuma variante de ctaRules (${ctaVariantNames.join(", ")}). Use pílula verde ou amarela.`,
      );
    }
    return ok(`Pílula "pill-solid-accent" em ${cta.pill.color}${cta.pill.shadow ? " com sombra sutil" : ""}.`);
  }
  return ok("CTA com destaque visual.");
}

/**
 * shapeClusterPattern ("mosaico-de-cacos"), sobre a geometria medida do preset:
 * preset existente, 3 a 5 peças, ≥2 cores, amarelo só em peça pequena, 1 protagonista maior que
 * as demais, nenhuma área sobreposta, nenhuma peça cobrindo textos/CTA.
 */
export function validateShapeClusters(
  layers: Layer[],
  bounds: Record<string, Rect>,
  reports: Record<string, ClusterReport>,
): ValidationResult {
  const clusters = layers.filter((l): l is ShapeClusterLayer => l.type === "cluster");
  if (clusters.length === 0) return warn("A peça não tem mosaico de shapes (shapeClusterPattern).");
  const { min, max } = clusterSizeRange();
  const texts = layers.filter((l) => l.type === "text" || l.type === "cta");
  const resumo: string[] = [];

  for (const c of clusters) {
    if (!clusterPresetIds.includes(c.preset)) {
      return block(`${c.label}: preset "${c.preset}" não está em shapeClusterPattern.hardcodedPresets.`);
    }
    const pieces = presetPieces(c.preset);
    const n = pieces.length;
    if (n < min || n > max) return block(`${c.label}: ${n} peças — o mosaico usa de ${min} a ${max}.`);

    const sizes = pieces.map(pieceSize);
    const largest = Math.max(...sizes);
    const colors = new Set(pieces.map((p) => p.color));
    if (colors.size < 2) return block(`${c.label}: mosaico de uma cor só; combine ao menos 2 (colorMix).`);
    const amareloGrande = pieces.find((p) => p.color === "amarelo" && pieceSize(p) >= largest);
    if (amareloGrande) return block(`${c.label}: amarelo só pode aparecer em peças pequenas (colorMix).`);
    if (sizes.filter((s) => s === largest).length > 1) {
      return block(`${c.label}: mais de uma peça do tamanho máximo; o mosaico precisa de 1 protagonista (scaleHierarchy).`);
    }

    const report = reports[c.id];
    if (!report) return block(`${c.label}: geometria do mosaico não foi medida.`);
    if (report.overlaps.length > 0) {
      const o = report.overlaps[0];
      return block(`${c.label}: ${pieces[o.a].file} e ${pieces[o.b].file} se sobrepõem (${o.pixels}px de área).`);
    }

    for (let i = 0; i < n; i++) {
      const item = bounds[`${c.id}:${i}`];
      const hit = item && texts.find((t) => bounds[t.id] && intersects(item, bounds[t.id]));
      if (hit) return block(`${c.label}: ${pieces[i].file} cobre "${hit.label}".`);
    }

    // Vão de cada peça até a vizinha mais próxima.
    const vaos = pieces.map((_, i) =>
      Math.min(...report.gaps.filter((g) => g.a === i || g.b === i).map((g) => g.distance)),
    );
    resumo.push(
      `preset ${c.preset}, ${n} peças (${[...colors].join(" + ")}); sem sobreposição; vão até a peça vizinha: ${vaos.map((v) => `${v.toFixed(1)}px`).join(", ")}`,
    );
  }
  return ok(`Mosaico "${composition.shapeClusterPattern.name}": ${resumo.join("; ")}.`);
}

/** typographyLineBreakRules: nenhuma linha (exceto a última) termina em palavra proibida. */
export function validateLineBreaks(layers: Layer[]): ValidationResult {
  const forbidden = new Set(forbiddenTrailingWords.map(normalizeWord));
  const viuvas: string[] = [];
  const quebras: string[] = [];
  for (const l of layers) {
    if (l.type !== "text") continue;
    const lines = breakText(l.text, l, l.highlight, l.fontSize, l.width).split("\n");
    lines.slice(0, -1).forEach((line) => {
      const last = line.split(" ").pop() ?? "";
      if (forbidden.has(normalizeWord(last))) viuvas.push(`${l.label}: "…${last}"`);
    });
    quebras.push(`${l.label}: ${lines.map((t) => `"${t.replace(/\*\*/g, "")}"`).join(" / ")}`);
  }
  if (viuvas.length) return block(`Linha terminando em artigo/preposição/conjunção: ${viuvas.join("; ")}.`);
  return ok(`Sem viúvas. ${quebras.join(" · ")}.`);
}
