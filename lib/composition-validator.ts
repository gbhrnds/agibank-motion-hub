import type { ClusterShape, Layer, Rect, ShapeClusterLayer } from "./alerta-spec";
import { CANVAS_SIZE, getBackground } from "./alerta-spec";
import type { ColorKey } from "./brand-tokens";
import type { ClusterReport } from "./cluster-geometry";
import {
  clusterColorCombos,
  clusterGapRule,
  clusterOverlapAllowed,
  clusterSizeRange,
  clusterZones,
  composition,
  ctaVariant,
  supportingScaleRange,
  typographyRange,
  type ScaleRole,
} from "./composition-tokens";
import type { ValidationResult } from "./contrast-validator";
import { forbiddenTrailingWords, hasHighlight, layoutRichText, parseHighlights } from "./rich-text";
import { normalizeWord } from "./text-wrap";

/**
 * Regras de config/composition-patterns.json. As regras "never*", "forbidden" e "restriction"
 * bloqueiam; a escala tipográfica é recomendação (warning).
 */

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

/** Variante de ctaRules.variants pela cor da pílula. */
function ctaVariantName(pillColor: ColorKey): string {
  return pillColor === "azulEscuro" || pillColor === "azulMedio" ? "pill-solid-dark" : "pill-solid-accent";
}

/** ctaRules: nunca texto solto; "pill-solid-dark" proibida sobre fundo azul Agibank. */
export function validateCtaStyle(layers: Layer[]): ValidationResult {
  const background = getBackground(layers);
  const ctas = layers.filter((l) => l.type === "cta");
  if (ctas.length === 0) return warn("A peça não tem CTA.");
  for (const cta of ctas) {
    if (cta.type !== "cta") continue;
    if (!cta.pill) {
      if (composition.ctaRules.neverPlainText) return block(`${cta.label} como texto solto. Use pílula ou caixa sólida.`);
      continue;
    }
    const variant = ctaVariant(ctaVariantName(cta.pill.color));
    const restriction = variant && "restriction" in variant ? variant.restriction : undefined;
    if (restriction === "nao-usar-sobre-fundo-azul-agibank-baixo-contraste" && background?.color === "azulAgibank") {
      return block(
        `Pílula ${cta.pill.color} sobre azulAgibank tem baixo contraste (ctaRules "${variant!.name}"). Use "pill-solid-accent" (verde ou amarelo).`,
      );
    }
    if (variant && "shadowRecommended" in variant && variant.shadowRecommended && !cta.pill.shadow) {
      return warn(`"${variant.name}" recomenda sombra sutil na pílula.`);
    }
    return ok(`Pílula "${variant?.name}" em ${cta.pill.color}${cta.pill.shadow ? " com sombra sutil" : ""}.`);
  }
  return ok("CTA com destaque visual.");
}

/** Nome da cor do shape no vocabulário de shapeClusterPattern.colorMix.allowedCombos. */
function clusterColorName(shape: ClusterShape, largest: number): string {
  if (shape.mode === "stroke") return `${shape.color}-outline`;
  if (shape.color === "amarelo") return shape.size <= largest / 2 ? "amarelo-accent-pequeno" : "amarelo";
  return shape.color;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

/**
 * shapeUsageRules + shapeClusterPattern ("mosaico-de-cacos"), sobre a geometria medida:
 * quantidade (3 a maxShapesPerCluster), ≥2 cores em combinação permitida, amarelo só pequeno,
 * hierarquia de escala (1 protagonista + coadjuvantes menores), shapes adjacentes sem
 * sobreposição (gap 0-6% do maior), zona válida com o protagonista sangrando, sem cobrir textos.
 */
export function validateShapeClusters(
  layers: Layer[],
  bounds: Record<string, Rect>,
  reports: Record<string, ClusterReport>,
): ValidationResult {
  const clusters = layers.filter((l): l is ShapeClusterLayer => l.type === "cluster");
  if (clusters.length === 0) return warn("A peça não tem cluster de shapes (shapeClusterPattern).");
  const { min, max } = clusterSizeRange();
  const texts = layers.filter((l) => l.type === "text" || l.type === "cta");
  const resumo: string[] = [];

  for (const c of clusters) {
    const n = c.shapes.length;
    if (n < min) return block(`${c.label}: ${n} shape(s) — "shape-unico-isolado-sem-cluster" é proibido; use de ${min} a ${max}.`);
    if (n > max) return block(`${c.label}: ${n} shapes — maxShapesPerCluster é ${max}.`);

    const largest = Math.max(...c.shapes.map((s) => s.size));
    const names = new Set(c.shapes.map((s) => clusterColorName(s, largest)));
    if (names.size < 2) return block(`${c.label}: cluster de uma cor só (${[...names].join("")}); combine ao menos 2.`);
    if (!clusterColorCombos.some((combo) => combo.every((name) => names.has(name)))) {
      return block(`${c.label}: combinação ${[...names].join(" + ")} não está em colorMix.allowedCombos.`);
    }
    const amarelos = c.shapes.filter((s) => s.color === "amarelo");
    if (amarelos.length > 1 || names.has("amarelo")) {
      return block(`${c.label}: amarelo só pode aparecer em 1 shape pequeno do cluster (colorMix.amareloRule).`);
    }

    // Hierarquia de escala: exatamente 1 protagonista; coadjuvantes bem menores.
    const scale = supportingScaleRange();
    const protagonistas = c.shapes.filter((s) => s.size === largest);
    const ratios = c.shapes.filter((s) => s.size !== largest).map((s) => s.size / largest);
    if (protagonistas.length > 1 || ratios.some((r) => r > scale.max)) {
      return block(
        `${c.label}: tamanhos homogêneos (${c.shapes.map((s) => `${s.size}px`).join(", ")}). Use 1 protagonista e coadjuvantes com até ${pct(scale.max)} do tamanho dele.`,
      );
    }

    if (!clusterZones.includes(c.zone)) return block(`${c.label}: zona "${c.zone}" não existe em shapeClusterPattern.positioning.`);

    const report = reports[c.id];
    if (!report) return block(`${c.label}: geometria do cluster não foi medida.`);
    if (!clusterOverlapAllowed && report.overlaps.length > 0) {
      const o = report.overlaps[0];
      return block(`${c.label}: ${c.shapes[o.a].file} e ${c.shapes[o.b].file} se sobrepõem (${o.pixels}px de área). O mosaico não permite sobreposição.`);
    }
    // Cada shape precisa encostar (gap ≤ máx.) em ao menos um vizinho; nenhum par adjacente abaixo do mín.
    const maxGap = (clusterGapRule.max / 100) * largest;
    const minGap = (clusterGapRule.min / 100) * largest;
    const vizinhos: string[] = [];
    for (let i = 0; i < n; i++) {
      const own = report.gaps.filter((g) => g.a === i || g.b === i);
      const nearest = own.reduce((best, g) => (g.distance < best.distance ? g : best));
      if (nearest.distance > maxGap + 1) {
        return block(`${c.label}: ${c.shapes[i].file} está solto (${nearest.distance.toFixed(1)}px do vizinho; máximo ${maxGap.toFixed(1)}px = ${clusterGapRule.max}% do maior).`);
      }
      if (nearest.distance < minGap) {
        return block(`${c.label}: ${c.shapes[i].file} está a ${nearest.distance.toFixed(1)}px do vizinho; mínimo ${minGap.toFixed(1)}px.`);
      }
    }
    for (const g of report.gaps) {
      if (g.distance <= maxGap + 1) vizinhos.push(`${g.distance.toFixed(1)}px`);
    }

    const prot = c.shapes.findIndex((s) => s.size === largest);
    if (c.zone === "canto-superior-direito-sangrando" && report.bleed[prot] <= 0) {
      return block(`${c.label}: o protagonista deve sangrar pelo canto superior direito.`);
    }

    for (let i = 0; i < n; i++) {
      const item = bounds[`${c.id}:${i}`];
      const hit = item && texts.find((t) => bounds[t.id] && intersects(item, bounds[t.id]));
      if (hit) return block(`${c.label}: ${c.shapes[i].file} cobre "${hit.label}".`);
    }

    resumo.push(
      `${n} shapes (${[...names].join(" + ")}); protagonista ${largest}px com ${pct(report.bleed[prot])} fora do frame; ` +
        `coadjuvantes ${ratios.map((r) => `${(1 / r).toFixed(1)}x menores`).join(" e ")}; sem sobreposição; encaixes a ${vizinhos.join(", ")}`,
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
    const { lines } = layoutRichText(parseHighlights(l.text), l, l.highlight, l.fontSize, l.width);
    lines.slice(0, -1).forEach((line) => {
      const last = line.split(" ").pop() ?? "";
      if (forbidden.has(normalizeWord(last))) viuvas.push(`${l.label}: "…${last}"`);
    });
    quebras.push(`${l.label} em ${lines.length} linha(s)`);
  }
  if (viuvas.length) return block(`Linha terminando em artigo/preposição/conjunção: ${viuvas.join("; ")}.`);
  return ok(`Sem viúvas. ${quebras.join(", ")}.`);
}

/** typographyScale: tamanho e peso por papel (titulo, corpo, cta). */
export function validateTypographyScale(layers: Layer[]): ValidationResult {
  const fora: string[] = [];
  for (const l of layers) {
    if (l.type !== "text" && l.type !== "cta") continue;
    const role: ScaleRole = l.type === "cta" ? "cta" : l.role;
    const { min, max, weights } = typographyRange(role);
    if (l.fontSize < min || l.fontSize > max) fora.push(`${l.label} ${l.fontSize}px (esperado ${min}-${max}px)`);
    if (!weights.includes(l.weight)) fora.push(`${l.label} peso ${l.weight} (esperado ${weights.join("/")})`);
  }
  if (fora.length > 0) return warn(`Fora da escala: ${fora.join("; ")}.`);
  const size = (role: string) =>
    layers.find((l) => (role === "cta" ? l.type === "cta" : l.type === "text" && l.role === role)) as { fontSize: number } | undefined;
  return ok(`Hierarquia: título ${size("titulo")?.fontSize}px › corpo ${size("corpo")?.fontSize}px › CTA ${size("cta")?.fontSize}px.`);
}
