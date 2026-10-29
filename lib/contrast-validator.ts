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
