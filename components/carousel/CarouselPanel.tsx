"use client";

import { useCallback, useState } from "react";
import { novoConvidado, novoEncerramento, SLIDE_LABEL, type Slide } from "@/lib/carousel";

interface CarouselPanelProps {
  slides: Slide[];
  setSlides: React.Dispatch<React.SetStateAction<Slide[]>>;
  legenda: string;
  setLegenda: (v: string) => void;
}

const fieldClass =
  "rounded-lg border border-agi-gray-border px-3 py-2 text-sm font-normal text-agi-blue-dark focus:border-agi-blue focus:outline-none focus:ring-2 focus:ring-agi-blue/30";
const iconBtn =
  "flex h-7 w-7 items-center justify-center rounded-full text-sm text-slate-500 transition-colors hover:bg-agi-gray-bg hover:text-agi-blue-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-agi-blue disabled:cursor-not-allowed disabled:opacity-30";
const addBtn =
  "w-full rounded-full border border-dashed border-agi-blue px-4 py-2 text-sm font-semibold text-agi-blue transition-colors hover:bg-agi-blue hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-agi-blue";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold text-agi-blue-dark">
      {label}
      {children}
    </label>
  );
}

/** Copia para a área de transferência; fallback para páginas sem Clipboard API (ex.: sandbox). */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.cssText = "position:fixed;left:-9999px;top:0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

/** Painel do carrossel de evento: cards de slide editáveis, reordenáveis e removíveis + legenda do post. */
export default function CarouselPanel({ slides, setSlides, legenda, setLegenda }: CarouselPanelProps) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<string | null>(null);

  const update = useCallback(
    (id: string, patch: Partial<Record<string, string | null>>) =>
      setSlides((prev) => prev.map((s) => (s.id === id ? ({ ...s, ...patch } as Slide) : s))),
    [setSlides],
  );

  const addConvidado = useCallback(() => {
    const novo = novoConvidado(slides);
    setOpen((o) => ({ ...o, [novo.id]: true }));
    setSlides((prev) => {
      // Entra antes do encerramento, se houver.
      const end = prev.findIndex((s) => s.tipo === "encerramento");
      return end === -1 ? [...prev, novo] : [...prev.slice(0, end), novo, ...prev.slice(end)];
    });
  }, [slides, setSlides]);

  const addEncerramento = useCallback(() => {
    const novo = novoEncerramento();
    setOpen((o) => ({ ...o, [novo.id]: true }));
    setSlides((prev) => [...prev, novo]);
  }, [setSlides]);

  const removeSlide = useCallback((index: number) => setSlides((prev) => prev.filter((_, i) => i !== index)), [setSlides]);

  const moveSlide = useCallback(
    (index: number, direction: -1 | 1) =>
      setSlides((prev) => {
        const to = index + direction;
        if (to < 0 || to >= prev.length) return prev;
        const next = [...prev];
        [next[index], next[to]] = [next[to], next[index]];
        return next;
      }),
    [setSlides],
  );

  const onPhoto = useCallback(
    (id: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => update(id, { foto: typeof reader.result === "string" ? reader.result : null });
      reader.readAsDataURL(file);
      e.target.value = "";
    },
    [update],
  );

  const copiar = useCallback(async () => {
    const ok = await copyText(legenda);
    setToast(ok ? "Copiado!" : "Não foi possível copiar");
    setTimeout(() => setToast(null), 2000);
  }, [legenda]);

  const convidadoN = (index: number) => slides.slice(0, index + 1).filter((s) => s.tipo === "convidado").length;

  return (
    <div className="flex flex-col gap-3" data-testid="carousel-panel">
      <ol className="flex flex-col gap-2">
        {slides.map((slide, index) => {
          const expanded = open[slide.id] ?? index === 0;
          const title =
            slide.tipo === "convidado"
              ? `${SLIDE_LABEL.convidado} ${convidadoN(index)}${slide.nome ? ` · ${slide.nome}` : ""}`
              : SLIDE_LABEL[slide.tipo];
          return (
            <li key={slide.id} className="rounded-xl border border-agi-gray-border bg-white" data-testid={`slide-card-${slide.tipo}`}>
              <div className="flex items-center gap-1 px-3 py-2">
                <button
                  type="button"
                  onClick={() => setOpen((o) => ({ ...o, [slide.id]: !expanded }))}
                  aria-expanded={expanded}
                  className="flex flex-1 items-center gap-2 truncate text-left text-sm font-semibold text-agi-blue-dark"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-agi-gray-bg text-[10px] tabular-nums">
                    {index + 1}
                  </span>
                  <span className="truncate">{title}</span>
                  <span className="ml-auto text-xs text-slate-400">{expanded ? "▾" : "▸"}</span>
                </button>
                <button type="button" className={iconBtn} onClick={() => moveSlide(index, -1)} disabled={index === 0} aria-label={`Mover slide ${index + 1} para cima`}>
                  ↑
                </button>
                <button type="button" className={iconBtn} onClick={() => moveSlide(index, 1)} disabled={index === slides.length - 1} aria-label={`Mover slide ${index + 1} para baixo`}>
                  ↓
                </button>
                <button type="button" className={iconBtn} onClick={() => removeSlide(index)} aria-label={`Remover slide ${index + 1}`}>
                  ✕
                </button>
              </div>

              {expanded && (
                <div className="flex flex-col gap-3 border-t border-agi-gray-border px-3 py-3">
                  {slide.tipo === "capa" && (
                    <>
                      <Field label="Nome do Evento">
                        <input className={fieldClass} value={slide.nomeEvento} placeholder="Meetup Agibank" onChange={(e) => update(slide.id, { nomeEvento: e.target.value })} />
                      </Field>
                      <Field label="Headline">
                        <input className={fieldClass} value={slide.headline} placeholder="Ciência de Dados" onChange={(e) => update(slide.id, { headline: e.target.value })} />
                      </Field>
                      <Field label="Data">
                        <input className={fieldClass} value={slide.data} placeholder="12 de novembro · 19h" onChange={(e) => update(slide.id, { data: e.target.value })} />
                      </Field>
                      <Field label="Texto do CTA">
                        <input className={fieldClass} value={slide.cta} placeholder="Inscreva-se" onChange={(e) => update(slide.id, { cta: e.target.value })} />
                      </Field>
                    </>
                  )}
                  {slide.tipo === "convidado" && (
                    <>
                      <div className="flex items-center gap-3">
                        {slide.foto ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={slide.foto} alt="" className="h-12 w-12 rounded-md object-cover" />
                        ) : (
                          <span className="flex h-12 w-12 items-center justify-center rounded-md bg-agi-gray-bg text-[10px] text-slate-400">sem foto</span>
                        )}
                        <label className="cursor-pointer rounded-full border border-agi-blue px-3 py-1 text-xs font-semibold text-agi-blue transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-agi-blue hover:bg-agi-blue hover:text-white">
                          {slide.foto ? "Trocar foto" : "Enviar foto"}
                          <input type="file" accept="image/*" className="sr-only" onChange={onPhoto(slide.id)} data-testid="foto-convidado" />
                        </label>
                      </div>
                      <Field label="Nome">
                        <input className={fieldClass} value={slide.nome} onChange={(e) => update(slide.id, { nome: e.target.value })} />
                      </Field>
                      <Field label="Cargo / Empresa">
                        <input className={fieldClass} value={slide.cargoEmpresa} onChange={(e) => update(slide.id, { cargoEmpresa: e.target.value })} />
                      </Field>
                      <Field label="Bio">
                        <textarea className={fieldClass} rows={3} value={slide.bio} onChange={(e) => update(slide.id, { bio: e.target.value })} />
                      </Field>
                    </>
                  )}
                  {slide.tipo === "encerramento" && (
                    <>
                      <Field label="Texto do CTA">
                        <input className={fieldClass} value={slide.cta} placeholder="Até o próximo encontro!" onChange={(e) => update(slide.id, { cta: e.target.value })} />
                      </Field>
                      <Field label="Link">
                        <input className={fieldClass} value={slide.link} placeholder="agibank.com.br/meetup" onChange={(e) => update(slide.id, { link: e.target.value })} />
                      </Field>
                    </>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <button type="button" onClick={addConvidado} className={addBtn}>
        + Adicionar Convidado
      </button>
      <button type="button" onClick={addEncerramento} className={addBtn}>
        + Adicionar Encerramento
      </button>

      <div className="mt-3 flex flex-col gap-2 border-t border-agi-gray-border pt-4">
        <Field label="Legenda do Post">
          <textarea
            className={fieldClass}
            rows={6}
            value={legenda}
            onChange={(e) => setLegenda(e.target.value)}
            placeholder="Texto que acompanha o carrossel no LinkedIn…"
          />
        </Field>
        <button
          type="button"
          onClick={copiar}
          disabled={!legenda.trim()}
          className="w-fit rounded-full border-2 border-agi-blue px-4 py-1.5 text-sm font-semibold text-agi-blue transition-colors hover:bg-agi-blue hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-agi-blue disabled:cursor-not-allowed disabled:border-agi-gray-border disabled:text-slate-400 disabled:hover:bg-transparent"
        >
          Copiar Legenda
        </button>
      </div>

      {toast && (
        <div role="status" className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-agi-blue-dark px-5 py-2 text-sm font-semibold text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
