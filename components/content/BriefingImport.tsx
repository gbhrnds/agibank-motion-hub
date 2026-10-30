"use client";

import { useCallback, useState } from "react";
import { parseBriefingText, type BriefingTexts, type ParsedBriefing } from "@/lib/briefing-parser";
import { SLIDE_LABEL, type Slide } from "@/lib/carousel";

export type ContentMode = "manual" | "upload";

const fieldClass =
  "rounded-lg border border-agi-gray-border px-3 py-2 text-sm font-normal text-agi-blue-dark focus:border-agi-blue focus:outline-none focus:ring-2 focus:ring-agi-blue/30";

/** Seletor global de modo do conteúdo (todas as frentes). Padrão: manual. */
export function ContentModeSwitch({ mode, setMode }: { mode: ContentMode; setMode: (m: ContentMode) => void }) {
  const option = (value: ContentMode, label: string) => (
    <label
      className={`flex flex-1 cursor-pointer items-center justify-center rounded-lg px-2 py-2 text-center text-xs font-semibold transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-agi-blue ${
        mode === value ? "bg-white text-agi-blue-dark shadow-sm" : "text-slate-500 hover:text-agi-blue-dark"
      }`}
    >
      <input type="radio" name="modo-conteudo" value={value} checked={mode === value} onChange={() => setMode(value)} className="sr-only" />
      {label}
    </label>
  );
  return (
    <div className="flex gap-1 rounded-xl bg-agi-gray-bg p-1" role="radiogroup" aria-label="Modo do conteúdo" data-testid="modo-conteudo">
      {option("upload", "📄 Importar Redação (arquivo)")}
      {option("manual", "✍️ Desdobrar a partir de KV")}
    </div>
  );
}

function Field({ label, value, onChange, multiline }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold text-agi-blue-dark">
      {label}
      {multiline ? (
        <textarea className={fieldClass} rows={3} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className={fieldClass} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}

const SLIDE_FIELDS: Record<Slide["tipo"], [string, string, boolean?][]> = {
  capa: [
    ["nomeEvento", "Nome do Evento"],
    ["headline", "Headline"],
    ["data", "Data"],
    ["cta", "Texto do CTA"],
  ],
  convidado: [
    ["nome", "Nome"],
    ["cargoEmpresa", "Cargo / Empresa"],
    ["bio", "Bio", true],
  ],
  encerramento: [
    ["cta", "Texto do CTA"],
    ["link", "Link"],
  ],
};

/** Texto do arquivo: .txt direto no navegador; .docx/.pdf pela rota de extração. */
async function extractText(file: File): Promise<string> {
  if (file.name.toLowerCase().endsWith(".txt")) return file.text();
  const body = new FormData();
  body.append("file", file);
  let res: Response;
  try {
    res = await fetch("/api/parse-briefing", { method: "POST", body });
  } catch {
    throw new Error("A importação de .docx/.pdf precisa do app publicado (servidor de extração indisponível).");
  }
  const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
  if (!res.ok || typeof data.text !== "string") {
    // Sem a rota (página estática): 404/405/501 e nenhuma resposta JSON.
    throw new Error(
      data.error ??
        ([404, 405, 501].includes(res.status)
          ? "A importação de .docx/.pdf precisa do app publicado (Vercel). Aqui, use um .txt ou o modo manual."
          : `Falha ao ler o arquivo (HTTP ${res.status}).`),
    );
  }
  return data.text;
}

interface BriefingImportProps {
  /** Tema ativo ("meetup" lê a redação por telas). */
  tema: string | null;
  /** Revisão confirmada ("Aplicar às Peças"): popula o estado real. */
  onApply: (parsed: ParsedBriefing) => void;
  /** Arquivo fora do padrão: volta ao modo manual com campos em branco. */
  onFallback: (message: string) => void;
}

/**
 * Importar Redação: envia o .docx/.pdf, interpreta o texto (lib/briefing-parser.ts) e mostra uma tela
 * de revisão com os campos editáveis. Nada chega às peças antes de "Aplicar às Peças".
 */
export default function BriefingImport({ tema, onApply, onFallback }: BriefingImportProps) {
  const [draft, setDraft] = useState<ParsedBriefing | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      setBusy(true);
      setError(null);
      setDraft(null);
      setFileName(file.name);
      try {
        const parsed = parseBriefingText(await extractText(file), { tema });
        if (!parsed.ok) {
          onFallback(`"${file.name}" não segue o padrão da redação${tema === "meetup" ? " (TELA 01, TELA 02…)" : ""}: preencha os campos manualmente.`);
          return;
        }
        setDraft(parsed);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [tema, onFallback],
  );

  const setText = (key: keyof BriefingTexts) => (v: string) =>
    setDraft((d) => (d?.kind === "simples" ? { ...d, texts: { ...d.texts, [key]: v } } : d));
  const setSlide = (id: string, key: string) => (v: string) =>
    setDraft((d) => (d?.kind === "meetup" ? { ...d, slides: d.slides.map((s) => (s.id === id ? ({ ...s, [key]: v } as Slide) : s)) } : d));

  return (
    <div className="flex flex-col gap-3" data-testid="importar-redacao">
      <label className="flex w-fit cursor-pointer items-center rounded-full border border-agi-blue px-4 py-1.5 text-sm font-semibold text-agi-blue transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-agi-blue hover:bg-agi-blue hover:text-white">
        {busy ? "Lendo…" : fileName ? "Trocar arquivo" : "Escolher arquivo (.docx ou .pdf)"}
        <input type="file" accept=".docx,.pdf,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="sr-only" onChange={onFile} disabled={busy} data-testid="arquivo-redacao" />
      </label>
      <p className="text-xs text-slate-500">
        {tema === "meetup"
          ? "Estrutura esperada: TELA 01 (capa), TELA 02… (convidados) e a última tela de encerramento."
          : "Rótulos reconhecidos: Título, Texto, Destaque e CTA."}{" "}
        O bloco LEGENDA é sempre descartado.
      </p>
      {error && (
        <p role="alert" className="text-xs font-semibold text-red-700">
          {error}
        </p>
      )}

      {draft && (
        <div className="flex flex-col gap-3 rounded-xl border border-agi-blue/40 bg-agi-blue/5 p-3" data-testid="revisao-redacao">
          <p className="text-xs font-semibold uppercase tracking-wider text-agi-blue-dark">Revisão · {fileName}</p>
          {draft.kind === "simples" ? (
            <>
              <Field label="Título (headline)" value={draft.texts.headline} onChange={setText("headline")} />
              <Field label="Texto de apoio" value={draft.texts.body} onChange={setText("body")} multiline />
              <Field label="Palavra em destaque" value={draft.texts.highlight} onChange={setText("highlight")} />
              <Field label="Texto do botão (CTA)" value={draft.texts.cta} onChange={setText("cta")} />
            </>
          ) : (
            <ol className="flex flex-col gap-2">
              {draft.slides.map((slide, i) => (
                <li key={slide.id} className="flex flex-col gap-2 rounded-lg border border-agi-gray-border bg-white p-3">
                  <span className="text-xs font-semibold text-slate-500">
                    Tela {String(i + 1).padStart(2, "0")} · {SLIDE_LABEL[slide.tipo]}
                  </span>
                  {SLIDE_FIELDS[slide.tipo].map(([key, label, multiline]) => (
                    <Field
                      key={key}
                      label={label}
                      value={String((slide as Record<string, unknown>)[key] ?? "")}
                      onChange={setSlide(slide.id, key)}
                      multiline={multiline}
                    />
                  ))}
                </li>
              ))}
            </ol>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                onApply(draft);
                setDraft(null);
                setFileName(null);
              }}
              className="flex-1 rounded-full bg-agi-blue px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-agi-blue-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-agi-blue"
            >
              Aplicar às Peças
            </button>
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="rounded-full border border-agi-gray-border px-4 py-2 text-sm font-semibold text-slate-600 hover:border-agi-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-agi-blue"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
