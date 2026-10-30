import { novaCapa, novoConvidado, novoEncerramento, type Slide } from "./carousel";
import type { PieceTexts } from "./format-config";

/**
 * Importação de redação: o texto extraído do .docx/.pdf (app/api/parse-briefing) vira conteúdo das
 * peças por heurística. Tudo passa pela tela de revisão antes de chegar ao estado real.
 */

export type BriefingTexts = Omit<PieceTexts, "ctaArrow">;

export interface BriefingContext {
  /** Tema ativo; "meetup" usa a estrutura de telas (TELA 01, TELA 02…). */
  tema: string | null;
}

export type ParsedBriefing =
  | { kind: "simples"; ok: boolean; texts: BriefingTexts }
  | { kind: "meetup"; ok: boolean; slides: Slide[] };

/** Marcador de tela da redação: "TELA 01:", "Tela 2 -", "TELA 03 –". */
const TELA = /TELA\s*0?\d+\s*[:\-–]/i;
/** Bloco "LEGENDA:" até a próxima tela (ou o fim do texto). */
const LEGENDA = /(^|\n)[ \t]*LEGENDA\b[^\n]*[\s\S]*?(?=\n[ \t]*TELA\s*0?\d+\s*[:\-–]|$)/gi;

/** Remove o bloco LEGENDA: a legenda do post é da redação, nunca entra nas peças nem no estado. */
export function stripLegenda(raw: string): string {
  return raw.replace(LEGENDA, "\n");
}

// Acentos combinantes (U+0300–U+036F), escritos como escapes: o bundle fica em ASCII.
const DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .toLowerCase()
    .trim();

/** Rótulos aceitos na redação → campo. */
const LABELS: Record<string, string> = {
  titulo: "headline",
  "titulo principal": "headline",
  headline: "headline",
  chamada: "headline",
  texto: "body",
  "texto de apoio": "body",
  apoio: "body",
  corpo: "body",
  subtitulo: "body",
  body: "body",
  cta: "cta",
  botao: "cta",
  "texto do botao": "cta",
  "call to action": "cta",
  "chamada para acao": "cta",
  destaque: "highlight",
  "palavra em destaque": "highlight",
  highlight: "highlight",
  data: "data",
  "data e hora": "data",
  quando: "data",
  horario: "data",
  evento: "nomeEvento",
  "nome do evento": "nomeEvento",
  nome: "nome",
  convidado: "nome",
  convidada: "nome",
  palestrante: "nome",
  speaker: "nome",
  cargo: "cargo",
  empresa: "empresa",
  "cargo/empresa": "cargoEmpresa",
  "cargo / empresa": "cargoEmpresa",
  "cargo e empresa": "cargoEmpresa",
  bio: "bio",
  minibio: "bio",
  "mini bio": "bio",
  sobre: "bio",
  descricao: "bio",
  link: "link",
  url: "link",
  site: "link",
  inscricoes: "link",
};

const LABEL_LINE = /^\s*([^:\n]{2,30}?)\s*:\s*(.*)$/;
const URL_RE = /\b((?:https?:\/\/)?(?:[\w-]+\.)+[a-z]{2,}(?:\/[^\s]*)?)/i;
const DATE_RE = /\b(\d{1,2}\s+de\s+[a-z\u00e7]+|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|\d{1,2}h\d{0,2})\b/i;

interface Block {
  fields: Record<string, string>;
  /** Linhas sem rótulo, na ordem. */
  loose: string[];
}

const LONG_FIELDS = new Set(["bio", "body"]);

/** Separa campos rotulados ("Título: …") das linhas soltas; linhas seguintes continuam o último rótulo. */
function readBlock(text: string): Block {
  const fields: Record<string, string> = {};
  const loose: string[] = [];
  let current: string | null = null;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) {
      // O .docx separa parágrafos com linha em branco: textos longos (bio, texto de apoio) continuam;
      // campos curtos (título, data, CTA…) terminam ali.
      if (current && !LONG_FIELDS.has(current)) current = null;
      continue;
    }
    const m = line.match(LABEL_LINE);
    const key = m ? LABELS[norm(m[1])] : undefined;
    if (m && key) {
      current = key;
      fields[key] = m[2].trim();
    } else if (current) {
      fields[current] = `${fields[current]} ${line}`.trim();
    } else {
      loose.push(line);
    }
  }
  return { fields, loose };
}

/** Conteúdo simples (headline / body / cta / highlight). */
export function parseSimples(text: string): BriefingTexts {
  const { fields, loose } = readBlock(text);
  const rest = [...loose];
  const headline = fields.headline ?? rest.shift() ?? "";
  // Sem rótulo, a última linha curta vira o CTA.
  const cta = fields.cta ?? (rest.length > 1 && rest[rest.length - 1].length <= 60 ? rest.pop()! : "");
  const body = fields.body ?? rest.join(" ");
  const highlight = fields.highlight ?? "";
  return { headline, body, cta, highlight };
}

type TipoTela = Slide["tipo"];

/** Tipo declarado no cabeçalho da tela ("TELA 01: CAPA"). */
function tipoDeclarado(header: string): TipoTela | null {
  const h = norm(header);
  if (/^capa\b/.test(h)) return "capa";
  if (/^(convidad|palestrant|speaker)/.test(h)) return "convidado";
  if (/^(encerramento|fechamento|final)\b/.test(h)) return "encerramento";
  return null;
}

/** Redação do Meetup em telas: capa, convidados e encerramento. */
export function parseMeetup(text: string): Slide[] {
  const chunks = text.split(TELA);
  const preamble = readBlock(chunks.shift() ?? "");
  const telas = chunks.map((chunk, i) => {
    const [first = "", ...others] = chunk.split("\n");
    const declared = tipoDeclarado(first);
    // Cabeçalho só com o tipo ("CAPA") sai do conteúdo; senão a primeira linha é conteúdo.
    const body = declared && first.trim().split(/\s+/).length <= 2 ? others.join("\n") : chunk;
    return { declared, block: readBlock(body), index: i };
  });

  const slides: Slide[] = [];
  telas.forEach(({ declared, block, index }) => {
    const { fields, loose } = block;
    const last = index === telas.length - 1;
    const allText = [...Object.values(fields), ...loose].join(" ");
    const tipo: TipoTela =
      declared ??
      (index === 0
        ? "capa"
        : last && !fields.nome && (fields.link || fields.cta || URL_RE.test(allText) || /encerra|ate o proximo|obrigad/.test(norm(allText)))
          ? "encerramento"
          : "convidado");

    if (tipo === "capa") {
      const rest = [...loose];
      const dateIdx = rest.findIndex((l) => DATE_RE.test(l));
      const data = fields.data ?? (dateIdx >= 0 ? rest.splice(dateIdx, 1)[0] : "");
      const headline = fields.headline ?? rest.shift() ?? "";
      const cta = fields.cta ?? (rest.length && rest[rest.length - 1].length <= 40 ? rest.pop()! : "");
      slides.push({
        ...novaCapa(),
        nomeEvento: fields.nomeEvento ?? preamble.fields.nomeEvento ?? "",
        headline,
        data,
        cta,
      } as Slide);
    } else if (tipo === "convidado") {
      const rest = [...loose];
      const nome = fields.nome ?? rest.shift() ?? "";
      const cargoEmpresa =
        fields.cargoEmpresa ?? ([fields.cargo, fields.empresa].filter(Boolean).join(" · ") || rest.shift() || "");
      const bio = fields.bio ?? rest.join(" ");
      slides.push({ ...novoConvidado(slides), nome, cargoEmpresa, bio } as Slide);
    } else {
      const url = fields.link ?? allText.match(URL_RE)?.[1] ?? "";
      const rest = loose.filter((l) => !l.includes(url) || !url);
      slides.push({ ...novoEncerramento(), cta: fields.cta ?? rest[0] ?? "", link: url } as Slide);
    }
  });
  // A capa é obrigatória no carrossel: se a redação não começar por ela, entra uma em branco.
  if (slides[0]?.tipo !== "capa") slides.unshift(novaCapa());
  return slides;
}

export function parseBriefingText(rawText: string, context: BriefingContext): ParsedBriefing {
  const text = stripLegenda(rawText.replace(/\r\n?/g, "\n"));
  if (context.tema === "meetup") {
    const hasTelas = TELA.test(text);
    const slides = hasTelas ? parseMeetup(text) : [novaCapa()];
    return { kind: "meetup", ok: hasTelas && slides.length > 1, slides };
  }
  const texts = parseSimples(text);
  // Segue o padrão quando tem título rotulado ou ao menos título + texto (uma frase solta não é redação).
  const { fields, loose } = readBlock(text);
  const ok = !!texts.headline.trim() && (!!fields.headline || loose.length >= 2 || Object.keys(fields).length >= 2);
  return { kind: "simples", ok, texts };
}
