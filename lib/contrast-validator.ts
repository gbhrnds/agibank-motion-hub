import type { BrandRules, ColorKey } from "./brand-tokens";

export type Severity = "ok" | "warning" | "blocking";

export interface ValidationResult {
  valid: boolean;
  severity: Severity;
  message: string;
}

/**
 * Verifica o par fundo/texto contra brandRules.contrastMap.
 * - texto em "preferido"                                    → ok
 * - texto de destaque (título/palavra-chave) em "destaque"   → ok
 * - fora de "preferido" e regra "obrigatorio: true"          → blocking
 * - fora de "preferido" sem obrigatoriedade                  → warning
 */
export function validateContrast(
  backgroundColorKey: ColorKey,
  textColorKey: ColorKey,
  brandRules: BrandRules,
  { destaque = false }: { destaque?: boolean } = {},
): ValidationResult {
  const rule = brandRules.contrastMap[backgroundColorKey];
  const preferido = rule?.preferido ?? [];
  const destaques = rule?.destaque ?? [];

  if (preferido.includes(textColorKey)) {
    return { valid: true, severity: "ok", message: `${textColorKey} sobre ${backgroundColorKey} é combinação preferida.` };
  }
  if (destaques.includes(textColorKey)) {
    return destaque
      ? { valid: true, severity: "ok", message: `${textColorKey} sobre ${backgroundColorKey} permitido como destaque.` }
      : {
          valid: false,
          severity: "blocking",
          message: `${textColorKey} sobre ${backgroundColorKey} só é permitido em títulos e palavras-chave, não em texto corrido.`,
        };
  }
  if (rule?.obrigatorio) {
    return {
      valid: false,
      severity: "blocking",
      message: `${textColorKey} sobre ${backgroundColorKey} não é permitido: a regra é obrigatória e exige ${preferido.join(" ou ")}${destaques.length ? ` (ou ${destaques.join("/")} em títulos e palavras-chave)` : ""}.`,
    };
  }
  return {
    valid: true,
    severity: "warning",
    message: rule
      ? `${textColorKey} sobre ${backgroundColorKey} não é preferido (preferidos: ${preferido.join(", ")}).`
      : `Não há regra de contraste para fundo ${backgroundColorKey}; revise manualmente.`,
  };
}

interface ColoredLayer {
  type: string;
  color?: ColorKey;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

/**
 * Verifica brandRules.colorUsage contra a camada de fundo (ex.: amarelo nunca como fundo dominante).
 * Com `coverage` (fração de pixels por cor, medida no canvas), confirma também que a cor do
 * fundo é a dominante da peça e que nenhuma cor "apenas detalhe" domina.
 */
export function validateColorUsage(
  layers: ColoredLayer[],
  brandRules: BrandRules,
  coverage?: Partial<Record<ColorKey, number>>,
): ValidationResult {
  const background = layers.find((l) => l.type === "background");
  if (!background?.color) {
    return { valid: false, severity: "blocking", message: "A peça não tem camada de fundo." };
  }
  const rule = brandRules.colorUsage[background.color];
  if (rule === "nunca-fundo-dominante-apenas-detalhe") {
    return {
      valid: false,
      severity: "blocking",
      message: `${background.color} nunca pode ser fundo dominante — use apenas em detalhes.`,
    };
  }
  if (!coverage) {
    return { valid: true, severity: "ok", message: `${background.color} é permitido como fundo.` };
  }

  const ranking = (Object.entries(coverage) as [ColorKey, number][]).sort((a, b) => b[1] - a[1]);
  const [dominant] = ranking[0];
  const resumo = ranking
    .filter(([, v]) => v >= 0.01)
    .map(([k, v]) => `${k} ${pct(v)}`)
    .join(" · ");
  if (dominant !== background.color) {
    return {
      valid: false,
      severity: "blocking",
      message: `${dominant} domina a peça (${pct(coverage[dominant] ?? 0)}) no lugar do fundo ${background.color}. ${resumo}.`,
    };
  }
  return { valid: true, severity: "ok", message: `Fundo ${background.color} dominante. ${resumo}.` };
}
