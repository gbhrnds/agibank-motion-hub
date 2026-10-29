import type { BrandRules, ColorKey } from "./brand-tokens";

export type Severity = "ok" | "warning" | "blocking";

export interface ValidationResult {
  valid: boolean;
  severity: Severity;
  message: string;
}

/**
 * Verifica o par fundo/texto contra brandRules.contrastMap.
 * - texto em "preferido"                           → ok
 * - fora de "preferido" e regra "obrigatorio: true" → blocking
 * - fora de "preferido" sem obrigatoriedade         → warning
 */
export function validateContrast(
  backgroundColorKey: ColorKey,
  textColorKey: ColorKey,
  brandRules: BrandRules,
): ValidationResult {
  const rule = brandRules.contrastMap[backgroundColorKey];
  const preferido = rule?.preferido ?? [];

  if (preferido.includes(textColorKey)) {
    return { valid: true, severity: "ok", message: `${textColorKey} sobre ${backgroundColorKey} é combinação preferida.` };
  }
  if (rule?.obrigatorio) {
    return {
      valid: false,
      severity: "blocking",
      message: `${textColorKey} sobre ${backgroundColorKey} não é permitido: a regra é obrigatória e exige ${preferido.join(" ou ")}.`,
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

/** Verifica brandRules.colorUsage contra a camada de fundo (ex.: amarelo nunca como fundo dominante). */
export function validateColorUsage(layers: ColoredLayer[], brandRules: BrandRules): ValidationResult {
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
  return { valid: true, severity: "ok", message: `${background.color} é permitido como fundo.` };
}
