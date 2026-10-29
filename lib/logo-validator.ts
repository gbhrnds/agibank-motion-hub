import type { LogoLayer } from "./alerta-spec";
import { audienceForChannel, brandTokens } from "./brand-tokens";
import type { ValidationResult } from "./contrast-validator";

/**
 * logos.audienceRule: a família do logo segue a audiência dos canais da peça
 * (canais internos → "agi", canais externos → "agibank").
 */
export function validateLogoAudience(logo: LogoLayer | undefined, channels: string[]): ValidationResult {
  if (!logo) return { valid: false, severity: "blocking", message: "A peça não tem logo." };

  const family = brandTokens.logos.audienceRule[logo.audience].logoFamily;
  const conflitos = channels.filter((c) => {
    const expected = audienceForChannel(c);
    return expected !== undefined && expected !== logo.audience;
  });
  if (conflitos.length > 0) {
    const expected = audienceForChannel(conflitos[0])!;
    return {
      valid: false,
      severity: "blocking",
      message: `Canal ${conflitos.join(", ")} é de audiência "${expected}" e exige o logo "${brandTokens.logos.audienceRule[expected].logoFamily}", mas a peça usa "${family}".`,
    };
  }
  const desconhecidos = channels.filter((c) => audienceForChannel(c) === undefined);
  if (desconhecidos.length > 0) {
    return {
      valid: true,
      severity: "warning",
      message: `Canal ${desconhecidos.join(", ")} não está em logos.audienceRule; confira se o logo "${family}" é o correto.`,
    };
  }
  return { valid: true, severity: "ok", message: `Audiência "${logo.audience}" → logo "${family}" (${channels.join(", ")}).` };
}
