import type { Layer } from "./alerta-spec";
import { brandRules, type ColorKey } from "./brand-tokens";
import { archetype, ctaStyles, ctaVariant, shapePalettes, type Range } from "./composition-tokens";
import type { ValidationResult } from "./contrast-validator";
import { AMARELO_MAX_SCALE, SCALE_BY_ROLE, SHAPE_UNIT, type KeepOutZone, type PieceLayout } from "./layout-engine";
import { breakText, forbiddenTrailingWords, hasHighlight } from "./rich-text";
import { gapBetween, getSilhouette, hitsRect, type PlacedShape } from "./shape-silhouette";
import { normalizeWord } from "./text-wrap";

/** Regras de config/composition-patterns.json (e de hierarquia de texto do assets-map.json). */

const block = (message: string): ValidationResult => ({ valid: false, severity: "blocking", message });
const warn = (message: string): ValidationResult => ({ valid: true, severity: "warning", message });
const ok = (message: string): ValidationResult => ({ valid: true, severity: "ok", message });

/** assets-map.json → brandRules.textHierarchy: nunca uma cor só no texto. */
export function validateTextHierarchy(layers: Layer[]): ValidationResult {
  const colors = new Set<string>();
  for (const l of layers) {
    if (l.type !== "text") continue;
    colors.add(l.color);
    if (l.highlight && hasHighlight(l.text)) colors.add(l.highlight.color);
  }
  if (colors.size < 2) {
    return block(`Texto monocromático (${[...colors].join(", ")}): ${brandRules.textHierarchy ?? "combine ao menos 2 cores"}.`);
  }
  return ok(`Texto em ${colors.size} cores: ${[...colors].join(" + ")}.`);
}

/** ctaRules.variants: a variante existe e a caixa corresponde a ela. */
export function validateCtaStyle(layers: Layer[]): ValidationResult {
  const cta = layers.find((l) => l.type === "cta");
  if (!cta || cta.type !== "cta") return warn("A peça não tem CTA.");
  if (!ctaStyles.includes(cta.variant)) return block(`Variante de CTA "${cta.variant}" não existe em ctaRules.variants.`);
  const v = ctaVariant(cta.variant);
  const pill = cta.pill;
  if (cta.variant === "pill-solid-accent" && !(pill?.fill === "verde" || pill?.fill === "amarelo")) {
    return block(`"${v.name}" precisa de fundo verde (ou amarelo) — ${v.description}`);
  }
  if (cta.variant === "pill-outline" && (!pill?.stroke || pill.fill || pill.stroke !== cta.color)) {
    return block(`"${v.name}" é fundo transparente com borda da mesma cor do texto — ${v.description}`);
  }
  if (cta.variant === "text-only-arrow" && (pill || !cta.trailingIcon)) {
    return block(`"${v.name}" é texto com seta, sem caixa — ${v.description}`);
  }
  return ok(`${v.name} (${cta.variant})${cta.align === "center" ? ", centralizado" : ""}.`);
}

const inRange = (v: number, [a, b]: Range) => v >= a - 1e-6 && v <= b + 1e-6;

/**
 * dynamicShapeArrangements + shapeColorsByBackground, sobre a silhueta real de cada shape:
 * arquétipo e contagem válidos, hierarquia de escala por papel, cores só da paleta sorteada
 * (e a paleta permitida para o fundo), amarelo só em shapes pequenos, sem sobreposição e sem
 * tocar textos/CTA/área do logo.
 */
export function validateShapeArrangement(
  piece: PieceLayout | null,
  background: ColorKey | undefined,
  keepOut: KeepOutZone[],
): ValidationResult {
  if (!piece) return block("Nenhum grafismo gerado ainda.");
  const spec = archetype(piece.shapeArchetype);
  const shapes = piece.shapes;

  const n = shapes.length;
  const count: Range = piece.shapeArchetype === "mosaico-hierarquico" ? [Math.max(3, spec.count[0]), spec.count[1]] : spec.count;
  if (!inRange(n, count)) return block(`${spec.name}: ${n} shape(s), esperado ${count.join("-")}.`);
  const foraDeEscala = shapes.find((s) => !inRange(s.scale, SCALE_BY_ROLE[s.role]));
  if (foraDeEscala) {
    return block(`${spec.name}: ${foraDeEscala.file} (${foraDeEscala.role}) com scale ${foraDeEscala.scale}, esperado ${SCALE_BY_ROLE[foraDeEscala.role].join("-")}.`);
  }

  const palettes = background ? shapePalettes(background) : [];
  const palette = palettes.find((p) => p.name === piece.shapePalette.name);
  if (!palette) return block(`Paleta "${piece.shapePalette.name}" não é permitida sobre ${background} (shapeColorsByBackground).`);
  const foraDaPaleta = shapes.find((s) => !palette.colors.includes(s.color));
  if (foraDaPaleta) return block(`${foraDaPaleta.file} em ${foraDaPaleta.color}, fora da paleta "${palette.name}" (${palette.colors.join(" + ")}).`);
  const amareloGrande = shapes.find((s) => s.color === "amarelo" && s.scale >= AMARELO_MAX_SCALE);
  if (amareloGrande) return block(`Amarelo em ${amareloGrande.file} com scale ${amareloGrande.scale}: amarelo é só detalhe (scale < ${AMARELO_MAX_SCALE}).`);

  const placed: PlacedShape[] = shapes.map((s) => ({ file: s.file, x: s.x, y: s.y, size: s.scale * SHAPE_UNIT, rotation: s.rotation }));
  const sils = shapes.map((s) => getSilhouette(s.file));
  if (sils.some((s) => !s)) return block("Silhuetas dos shapes ainda não carregadas.");
  for (let i = 0; i < n; i++) {
    const zone = keepOut.find((z) => hitsRect(sils[i]!, placed[i], z.rect));
    if (zone) return block(`${shapes[i].file} invade "${zone.label}".`);
  }
  let encaixe = "";
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const g = gapBetween(sils[i]!, placed[i], sils[j]!, placed[j]);
      if (g === 0) return block(`${shapes[i].file} e ${shapes[j].file} se sobrepõem.`);
      if (shapes[i].role === "protagonista" && shapes[j].role === "medio") {
        encaixe = `; médio encaixado a ${g.toFixed(1)}px (${((g / placed[j].size) * 100).toFixed(1)}% do médio)`;
      }
    }
  }
  const usadas = [...new Set(shapes.map((s) => s.color))];
  return ok(`${spec.name}: ${n} shape(s) em ${usadas.join(" + ")} (paleta "${palette.name}"); nenhum sobre textos, CTA ou logo${encaixe}.`);
}

/** Shapes cuja silhueta cai num retângulo (ex.: área de proteção do logo). */
export function shapesHittingZone(layout: PieceLayout | null, zone: KeepOutZone["rect"] | null): string[] {
  if (!layout || !zone) return [];
  return layout.shapes
    .filter((s) => {
      const sil = getSilhouette(s.file);
      return sil && hitsRect(sil, { file: s.file, x: s.x, y: s.y, size: s.scale * SHAPE_UNIT, rotation: s.rotation }, zone);
    })
    .map((s) => s.file);
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
