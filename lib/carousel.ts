import { temaEvento } from "./theme-config";

/**
 * Slides do carrossel de evento (1 capa, N convidados, encerramento opcional). `id` só identifica o card.
 * `seta`: o CTA só leva o ícone de seta quando o usuário marca "Incluir ícone de seta" (padrão: sem seta).
 */
export type Slide =
  | { id: string; tipo: "capa"; nomeEvento: string; headline: string; data: string; cta: string; seta: boolean }
  | {
      id: string;
      tipo: "convidado";
      foto: string | null; // dataURL
      nome: string;
      cargoEmpresa: string;
      bio: string;
      mascaraId: string;
    }
  | { id: string; tipo: "encerramento"; cta: string; link: string; seta: boolean };

export const SLIDE_LABEL: Record<Slide["tipo"], string> = {
  capa: "Capa",
  convidado: "Convidado",
  encerramento: "Encerramento",
};

/** Lado do slide do carrossel (LinkedIn Carrossel, 1080×1080). */
export const CAROUSEL_SIZE = { width: 1080, height: 1080 };

let counter = 0;
const newId = () => `slide-${Date.now().toString(36)}-${(counter++).toString(36)}`;

export const novaCapa = (): Slide => ({ id: newId(), tipo: "capa", nomeEvento: "", headline: "", data: "", cta: "", seta: false });
export const novoEncerramento = (): Slide => ({ id: newId(), tipo: "encerramento", cta: "", link: "", seta: false });

/** Próxima máscara em round-robin, a partir da máscara do último convidado da lista. */
export function proximaMascara(slides: Slide[]): string {
  const ids = temaEvento.mascaras.map((m) => m.id);
  const last = [...slides].reverse().find((s) => s.tipo === "convidado");
  const i = last && last.tipo === "convidado" ? ids.indexOf(last.mascaraId) : -1;
  return ids[(i + 1) % ids.length];
}

export function novoConvidado(slides: Slide[]): Slide {
  return { id: newId(), tipo: "convidado", foto: null, nome: "", cargoEmpresa: "", bio: "", mascaraId: proximaMascara(slides) };
}

/** Troca o tipo de um slide de tela (Convidado ↔ Encerramento), mantendo o card (mesmo `id`). */
export function trocarTipo(slides: Slide[], id: string, tipo: "convidado" | "encerramento"): Slide[] {
  const others = slides.filter((s) => s.id !== id);
  return slides.map((s) => {
    if (s.id !== id || s.tipo === tipo || s.tipo === "capa") return s;
    return { ...(tipo === "convidado" ? novoConvidado(others) : novoEncerramento()), id };
  });
}

/** Nome do evento: vem da capa e se repete nos demais slides. */
export function nomeDoEvento(slides: Slide[]): string {
  const capa = slides.find((s) => s.tipo === "capa");
  return capa && capa.tipo === "capa" ? capa.nomeEvento : "";
}

/** "Meetup Agibank" → "Meetup **Agibank**": primeira palavra fina, o resto em bold (como na peça de referência). */
export function nomeEstilizado(nome: string): string {
  const words = nome.replace(/\*\*/g, "").trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return words.length ? `**${words[0]}**` : "";
  return `${words[0]} **${words.slice(1).join(" ")}**`;
}
