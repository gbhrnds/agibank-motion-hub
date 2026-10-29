import type { Layer, Rect } from "./alerta-spec";
import { CANVAS_SIZE } from "./alerta-spec";
import { composition, shapePatternNames, typographyRange, type ScaleRole } from "./composition-tokens";
import type { ValidationResult } from "./contrast-validator";
import { hasHighlight } from "./rich-text";

/**
 * Regras de config/composition-patterns.json. As regras marcadas "never*: true" bloqueiam;
 * a escala tipográfica é recomendação (warning).
 */

const block = (message: string): ValidationResult => ({ valid: false, severity: "blocking", message });
const warn = (message: string): ValidationResult => ({ valid: true, severity: "warning", message });
const ok = (message: string): ValidationResult => ({ valid: true, severity: "ok", message });

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

/** ctaRules.neverPlainText: CTA precisa de pílula/caixa sólida. */
export function validateCtaStyle(layers: Layer[]): ValidationResult {
  const ctas = layers.filter((l) => l.type === "cta");
  if (ctas.length === 0) return warn("A peça não tem CTA.");
  const soltos = ctas.filter((l) => l.type === "cta" && !l.pill);
  if (composition.ctaRules.neverPlainText && soltos.length > 0) {
    return block(`CTA como texto solto: ${soltos.map((l) => l.label).join(", ")}. Use pílula ou caixa sólida.`);
  }
  return ok("CTA em pílula sólida com cantos arredondados.");
}

function outsideCanvas(r: Rect): boolean {
  return r.x < 0 || r.y < 0 || r.x + r.width > CANVAS_SIZE || r.y + r.height > CANVAS_SIZE;
}

/** shapeUsageRules.neverDecorativeOnly: todo shape tem função; "sangrando" precisa sair do frame. */
export function validateShapeFunction(layers: Layer[], bounds: Record<string, Rect>): ValidationResult {
  const problemas: string[] = [];
  const funcoes: string[] = [];
  for (const l of layers) {
    if (l.type !== "shape" && l.type !== "connector") continue;
    if (!l.funcao || !shapePatternNames.includes(l.funcao)) {
      problemas.push(`${l.label} sem função definida`);
      continue;
    }
    if (l.funcao === "shape-sangrando-do-frame" && bounds[l.id] && !outsideCanvas(bounds[l.id])) {
      problemas.push(`${l.label} deveria sangrar para fora do frame, mas está contido`);
      continue;
    }
    funcoes.push(l.funcao);
  }
  if (composition.shapeUsageRules.neverDecorativeOnly && problemas.length > 0) {
    return block(`${problemas.join("; ")}.`);
  }
  return ok(funcoes.length ? `Elementos gráficos com função: ${[...new Set(funcoes)].join(", ")}.` : "Sem shapes.");
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
