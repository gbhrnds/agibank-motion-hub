import type { Layer } from "./alerta-spec";
import { amareloMaxScale, archetype, colorCombos, composition, ctaVariantNames, type Range } from "./composition-tokens";
import type { ValidationResult } from "./contrast-validator";
import { SHAPE_UNIT, type GeneratedLayout, type KeepOutZone } from "./layout-engine";
import { breakText, forbiddenTrailingWords, hasHighlight } from "./rich-text";
import { gapBetween, getSilhouette, hitsRect, type PlacedShape } from "./shape-silhouette";
import { normalizeWord } from "./text-wrap";

/** Regras de config/composition-patterns.json. */

const block = (message: string): ValidationResult => ({ valid: false, severity: "blocking", message });
const warn = (message: string): ValidationResult => ({ valid: true, severity: "warning", message });
const ok = (message: string): ValidationResult => ({ valid: true, severity: "ok", message });

/** textHierarchyRules: "Nunca usar cor única no texto." */
export function validateTextHierarchy(layers: Layer[]): ValidationResult {
  const colors = new Set<string>();
  for (const l of layers) {
    if (l.type !== "text") continue;
    colors.add(l.color);
    if (l.highlight && hasHighlight(l.text)) colors.add(l.highlight.color);
  }
  if (colors.size < 2) {
    return block(`Texto monocromático (${[...colors].join(", ")}). ${composition.textHierarchyRules.rule}`);
  }
  return ok(`Texto em ${colors.size} cores: ${[...colors].join(" + ")}.`);
}

/** ctaRules.variants "pill-solid-accent": "Pílula verde ou amarela, texto azul escuro". */
const ACCENT_PILL_COLORS = ["verde", "amarelo"];

/** ctaRules: contraste real — pílula verde/amarela; sem caixa só como "cta-bold-inline" (peças com foto). */
export function validateCtaStyle(layers: Layer[]): ValidationResult {
  const cta = layers.find((l) => l.type === "cta");
  if (!cta || cta.type !== "cta") return warn("A peça não tem CTA.");
  if (!cta.pill) {
    return warn(`${cta.label} sem caixa: a variante "cta-bold-inline" é indicada para peças com foto.`);
  }
  if (!ACCENT_PILL_COLORS.includes(cta.pill.color) || !ctaVariantNames.includes("pill-solid-accent")) {
    return block(`Pílula ${cta.pill.color} sem contraste real; ctaRules pede pílula verde ou amarela.`);
  }
  return ok(`Pílula "pill-solid-accent" em ${cta.pill.color}${cta.pill.shadow ? " com sombra sutil" : ""}.`);
}

const inRange = (v: number, [a, b]: Range) => v >= a - 1e-6 && v <= b + 1e-6;

/** Nome da cor do shape no vocabulário de colorMix.allowedCombos. */
const comboName = (color: string, mode: string) =>
  mode === "stroke" ? `${color}-outline` : color === "amarelo" ? "amarelo-pequeno" : color;

/**
 * dynamicShapeArrangements, sobre a silhueta real de cada shape: arquétipo válido, contagens e
 * escalas do arquétipo, cores de uma combinação permitida (amarelo só com scale < 0.4), shapes sem
 * sobreposição entre si e sem tocar textos/CTA/área do logo.
 */
export function validateShapeArrangement(layout: GeneratedLayout | null, keepOut: KeepOutZone[]): ValidationResult {
  if (!layout) return block("Nenhum grafismo gerado ainda.");
  const spec = archetype(layout.archetype);
  if (spec.isMask) return block(`O arquétipo "${spec.name}" precisa de foto, que ainda não é suportada.`);
  const shapes = layout.shapes;

  const byRole = (role: string) => shapes.filter((s) => s.role === role);
  const checks: { label: string; list: typeof shapes; rule?: { count: Range; scale: Range } }[] = spec.shapes
    ? [{ label: "shapes", list: shapes, rule: spec.shapes }]
    : [
        { label: "protagonista", list: byRole("protagonista"), rule: spec.protagonista },
        { label: "coadjuvantes", list: byRole("coadjuvante"), rule: spec.coadjuvantes },
      ];
  for (const { label, list, rule } of checks) {
    if (!rule) continue;
    if (!inRange(list.length, rule.count)) return block(`${spec.name}: ${list.length} ${label}, esperado ${rule.count.join("-")}.`);
    const fora = list.find((s) => !inRange(s.scale, rule.scale));
    if (fora) return block(`${spec.name}: ${fora.file} com scale ${fora.scale}, esperado ${rule.scale.join("-")} (${label}).`);
  }

  const names = new Set(shapes.map((s) => comboName(s.color, s.mode)));
  if (!colorCombos.some((combo) => [...names].every((n) => combo.includes(n)))) {
    return block(`Cores ${[...names].join(" + ")} não formam uma combinação de colorMix.allowedCombos.`);
  }
  const amareloGrande = shapes.find((s) => s.color === "amarelo" && s.scale >= amareloMaxScale());
  if (amareloGrande) return block(`Amarelo em ${amareloGrande.file} com scale ${amareloGrande.scale}; só em shapes com scale < ${amareloMaxScale()}.`);

  const placed: PlacedShape[] = shapes.map((s) => ({ file: s.file, x: s.x, y: s.y, size: s.scale * SHAPE_UNIT, rotation: s.rotation }));
  const sils = shapes.map((s) => getSilhouette(s.file));
  if (sils.some((s) => !s)) return block("Silhuetas dos shapes ainda não carregadas.");

  for (let i = 0; i < shapes.length; i++) {
    const zone = keepOut.find((z) => hitsRect(sils[i]!, placed[i], z.rect));
    if (zone) return block(`${shapes[i].file} invade "${zone.label}".`);
  }
  const gaps: number[] = [];
  for (let i = 0; i < shapes.length; i++) {
    for (let j = i + 1; j < shapes.length; j++) {
      const g = gapBetween(sils[i]!, placed[i], sils[j]!, placed[j]);
      if (!spec.overlap && g === 0) return block(`${shapes[i].file} e ${shapes[j].file} se sobrepõem.`);
      gaps.push(g);
    }
  }
  const extra =
    layout.archetype === "mosaico-dupla" && gaps.length
      ? `; vão de ${gaps[0].toFixed(1)}px (${((gaps[0] / (Math.max(...shapes.map((s) => s.scale)) * SHAPE_UNIT)) * 100).toFixed(1)}% do maior)`
      : "";
  return ok(
    `${spec.name}: ${shapes.length} shape(s) em ${[...names].join(" + ")}; nenhum sobre textos, CTA ou logo${extra}.`,
  );
}

/** Shapes cuja silhueta cai num retângulo (ex.: área de proteção do logo). */
export function shapesHittingZone(layout: GeneratedLayout | null, zone: KeepOutZone["rect"] | null): string[] {
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
