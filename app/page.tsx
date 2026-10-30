"use client";

import dynamic from "next/dynamic";
import type Konva from "konva";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CarouselPanel, { SetaCheckbox } from "@/components/carousel/CarouselPanel";
import BriefingImport, { ContentModeSwitch, type ContentMode } from "@/components/content/BriefingImport";
import type { ParsedBriefing } from "@/lib/briefing-parser";
import { localMirror, logoPath, pickLogoKey, shapePath } from "@/lib/brand-tokens";
import {
  DEFAULT_TEXTS,
  MENU_CONFIG,
  pieceContext,
  type FormatSpec,
  type FrenteId,
  type PieceTexts,
} from "@/lib/format-config";
import { CAROUSEL_SIZE, nomeDoEvento, novaCapa, type Slide } from "@/lib/carousel";
import { exportPdfPages } from "@/lib/export";
import { allShapeFiles, pickPieceRun, type PieceRun } from "@/lib/layout-engine";
import { temaPorId, temasPorSubtipo, type ThemeId } from "@/lib/theme-config";
import { loadSilhouette, type Silhouette } from "@/lib/shape-silhouette";

const FormatArtboard = dynamic(() => import("@/components/canvas/FormatArtboard"), { ssr: false });
const CarouselPreview = dynamic(() => import("@/components/carousel/CarouselPreview"), { ssr: false });

/** Fundo da peça base (lib/piece-spec.ts → buildLayers). */
const BACKGROUND = "azulAgibank" as const;
/** Logo da interface: Agi reduzido (uso interno), versão positiva sobre o branco da barra lateral. */
const UI_LOGO = logoPath(pickLogoKey("interno", "fundoBranco", "digital"));

function StepTitle({ step, children }: { step: number; children: React.ReactNode }) {
  return (
    <legend className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-agi-blue text-[10px] text-white">
        {step}
      </span>
      {children}
    </legend>
  );
}

const optionClass = (active: boolean) =>
  `flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-agi-blue ${
    active
      ? "border-agi-blue bg-agi-blue/5 font-semibold text-agi-blue-dark"
      : "border-agi-gray-border bg-white text-slate-700 hover:border-agi-blue/50"
  }`;

const fieldClass =
  "rounded-lg border border-agi-gray-border px-3 py-2 text-sm font-normal text-agi-blue-dark focus:border-agi-blue focus:outline-none focus:ring-2 focus:ring-agi-blue/30";

export default function Page() {
  const [selectedFrente, setSelectedFrente] = useState<FrenteId | null>(null);
  const [selectedSubtipo, setSelectedSubtipo] = useState<string | null>(null);
  const [selectedFormats, setSelectedFormats] = useState<FormatSpec[]>([]);
  const [run, setRun] = useState<PieceRun | null>(null);
  const [silhouettes, setSilhouettes] = useState<Record<string, Silhouette> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [texts, setTexts] = useState<PieceTexts>(DEFAULT_TEXTS);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isFrenteVerso, setIsFrenteVerso] = useState(false);
  const [tema, setTema] = useState<ThemeId | null>(null);
  const [slides, setSlides] = useState<Slide[]>(() => [novaCapa()]);
  const [exportingCarousel, setExportingCarousel] = useState(false);
  // Conteúdo: manual (padrão) ou importado de um arquivo de redação, com revisão antes de aplicar.
  const [contentMode, setContentMode] = useState<ContentMode>("manual");
  const [contentNotice, setContentNotice] = useState<string | null>(null);
  const slideStages = useRef(new Map<string, Konva.Stage>());

  // Silhuetas de todos os shapes do assets-map.json (usadas pelo motor para evitar textos e logo).
  useEffect(() => {
    Promise.all(allShapeFiles.map((f) => loadSilhouette(f, shapePath(f))))
      .then((list) => setSilhouettes(Object.fromEntries(list.map((s) => [s.file, s]))))
      .catch((err) => setError(String(err instanceof Error ? err.message : err)));
  }, []);

  // Primeiro estado global já sorteado: as pranchetas aparecem completas assim que o formato é marcado.
  useEffect(() => setRun(pickPieceRun(BACKGROUND)), []);

  // Temas só existem para alguns subtipos (Eventos, Programas/Formações); nos demais, nenhum.
  const temas = (selectedFrente === "me" && selectedSubtipo && temasPorSubtipo[selectedSubtipo]) || null;
  const temaAtivo = temaPorId(temas ? selectedSubtipo : null, tema);

  const ctx = useMemo(
    () =>
      selectedFrente && selectedSubtipo ? pieceContext(selectedFrente, selectedSubtipo, temaAtivo?.assetsMapKey) : null,
    [selectedFrente, selectedSubtipo, temaAtivo?.assetsMapKey],
  );

  const chooseSubtipo = useCallback(
    (id: string) => {
      setSelectedSubtipo(id);
      // O primeiro tema do subtipo já vem marcado (ex.: Eventos → Meetup).
      setTema(selectedFrente === "me" ? (temasPorSubtipo[id]?.[0]?.id ?? null) : null);
    },
    [selectedFrente],
  );

  const chooseFrente = useCallback((id: FrenteId) => {
    setSelectedFrente(id);
    setSelectedSubtipo(null);
    setTema(null);
    setSelectedFormats([]);
  }, []);

  const toggleFormat = useCallback(
    (format: FormatSpec) => {
      setSelectedFormats((prev) => {
        const next = prev.some((f) => f.id === format.id) ? prev.filter((f) => f.id !== format.id) : [...prev, format];
        // Mantém a ordem do menu.
        const order = selectedFrente ? MENU_CONFIG.formatos[selectedFrente].map((f) => f.id) : [];
        return next.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
      });
    },
    [selectedFrente],
  );

  const generate = useCallback(() => setRun(pickPieceRun(BACKGROUND)), []);

  const setText = useCallback(
    (key: Exclude<keyof PieceTexts, "ctaArrow">) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setTexts((prev) => ({ ...prev, [key]: e.target.value })),
    [],
  );

  const onUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setUploadedImage(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => setError("Não foi possível ler a imagem enviada.");
    reader.readAsDataURL(file);
    // Permite enviar o mesmo arquivo de novo depois de "Remover imagem".
    e.target.value = "";
  }, []);

  const applyBriefing = useCallback((parsed: ParsedBriefing) => {
    if (parsed.kind === "meetup") setSlides(parsed.slides);
    else setTexts((prev) => ({ ...prev, ...parsed.texts }));
    setContentMode("manual");
    setContentNotice("Redação aplicada às peças. Ajuste o que precisar abaixo.");
  }, []);

  // Arquivo fora do padrão: campos em branco no modo manual, sem travar o usuário.
  const briefingFallback = useCallback(
    (message: string) => {
      if (temaAtivo?.id === "meetup") setSlides([novaCapa()]);
      else setTexts({ headline: "", body: "", highlight: "", cta: "", ctaArrow: false });
      setContentMode("manual");
      setContentNotice(message);
    },
    [temaAtivo?.id],
  );

  const chooseContentMode = useCallback((mode: ContentMode) => {
    setContentMode(mode);
    setContentNotice(null);
  }, []);

  const contentHeader = (tema: string | null) => (
    <>
      <ContentModeSwitch mode={contentMode} setMode={chooseContentMode} />
      {contentNotice && contentMode === "manual" && (
        <p role="status" className="text-xs font-semibold text-agi-blue-dark">
          {contentNotice}
        </p>
      )}
      {contentMode === "upload" && <BriefingImport tema={tema} onApply={applyBriefing} onFallback={briefingFallback} />}
    </>
  );

  const showVerso = selectedFrente === "impresso" && isFrenteVerso;
  // Tema "Meetup": carrossel de LinkedIn com N slides no lugar do desdobramento.
  const carouselMode = temaAtivo?.id === "meetup";
  const carouselFormat = MENU_CONFIG.formatos.me.find((f) => f.id === "linkedin_carrossel")!;
  const stepFormatos = temas ? 4 : 3;

  const registerStage = useCallback((id: string, stage: Konva.Stage | null) => {
    if (stage) slideStages.current.set(id, stage);
    else slideStages.current.delete(id);
  }, []);

  // Uma página por slide, na ordem exibida na tela.
  const exportCarousel = useCallback(async () => {
    const stages = slides.map((s) => slideStages.current.get(s.id)).filter((s): s is Konva.Stage => !!s);
    if (stages.length === 0) return;
    setExportingCarousel(true);
    try {
      const slug = nomeDoEvento(slides)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      await exportPdfPages(stages, {
        baseName: `agibank-me-carrossel${slug ? `-${slug}` : ""}`,
        size: CAROUSEL_SIZE,
      });
    } catch (err) {
      setError(`Falha ao exportar o carrossel: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setExportingCarousel(false);
    }
  }, [slides]);

  return (
    <div className="flex w-full flex-col bg-agi-gray-bg font-sans lg:h-screen lg:flex-row lg:overflow-hidden">
      <aside className="z-10 flex w-full flex-col border-agi-gray-border bg-white shadow-lg lg:w-96 lg:shrink-0 lg:border-r">
        <header className="flex items-center gap-3 border-b border-agi-gray-border px-6 py-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={UI_LOGO}
            alt="agi"
            className="h-7 w-auto"
            onError={(e) => {
              const local = localMirror(e.currentTarget.src);
              if (local && e.currentTarget.src !== local) e.currentTarget.src = local;
            }}
          />
          <div className="leading-tight">
            <h1 className="text-lg font-extrabold text-agi-blue-dark">Brand Studio</h1>
            <p className="text-xs text-slate-500">Desdobramento de peças</p>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
          <fieldset>
            <StepTitle step={1}>Frente</StepTitle>
            <div className="flex flex-wrap gap-2">
              {MENU_CONFIG.frentes.map((f) => {
                const active = selectedFrente === f.id;
                return (
                  <label
                    key={f.id}
                    className={`cursor-pointer rounded-full border px-4 py-2 text-sm transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-agi-blue ${
                      active
                        ? "border-agi-blue bg-agi-blue font-semibold text-white"
                        : "border-agi-gray-border bg-white text-slate-700 hover:border-agi-blue/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="frente"
                      value={f.id}
                      checked={active}
                      onChange={() => chooseFrente(f.id as FrenteId)}
                      className="sr-only"
                    />
                    {f.label}
                  </label>
                );
              })}
            </div>
          </fieldset>

          {selectedFrente === "impresso" && (
            <label className="-mt-3 flex items-center gap-2 rounded-xl border border-agi-gray-border px-4 py-3 text-sm font-semibold text-agi-blue-dark">
              <input
                type="checkbox"
                checked={isFrenteVerso}
                onChange={(e) => setIsFrenteVerso(e.target.checked)}
                className="h-4 w-4 accent-agi-blue"
              />
              Gerar Frente e Verso
            </label>
          )}

          {selectedFrente && (
            <fieldset>
              <StepTitle step={2}>Subtipo</StepTitle>
              <div className="flex flex-col gap-2">
                {MENU_CONFIG.subtipos[selectedFrente].map((s) => (
                  <label key={s.id} className={optionClass(selectedSubtipo === s.id)}>
                    <input
                      type="radio"
                      name="subtipo"
                      value={s.id}
                      checked={selectedSubtipo === s.id}
                      onChange={() => chooseSubtipo(s.id)}
                      className="h-4 w-4 accent-agi-blue"
                    />
                    {s.label}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {temas && (
            <fieldset>
              <StepTitle step={3}>Tema</StepTitle>
              <div className="flex flex-wrap gap-2">
                {temas.map((t) => (
                  <label key={t.id} className={optionClass(tema === t.id)}>
                    <input
                      type="radio"
                      name="tema"
                      value={t.id}
                      checked={tema === t.id}
                      onChange={() => setTema(t.id)}
                      className="h-4 w-4 accent-agi-blue"
                    />
                    {t.label}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {carouselMode && (
            <fieldset>
              <StepTitle step={stepFormatos}>Formato</StepTitle>
              <div className={optionClass(true)}>
                <span className="flex-1">{carouselFormat.label}</span>
                <span className="text-xs tabular-nums text-slate-500">
                  {carouselFormat.width}×{carouselFormat.height}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                O tema Meetup gera o carrossel: capa, convidados e encerramento.
              </p>
            </fieldset>
          )}

          {carouselMode && (
            <fieldset className="flex flex-col gap-3">
              <StepTitle step={stepFormatos + 1}>Slides</StepTitle>
              {contentHeader("meetup")}
              {contentMode === "manual" && <CarouselPanel slides={slides} setSlides={setSlides} />}
            </fieldset>
          )}

          {!carouselMode && selectedFrente && selectedSubtipo && (
            <fieldset>
              <StepTitle step={stepFormatos}>Formatos</StepTitle>
              <div className="flex flex-col gap-2">
                {MENU_CONFIG.formatos[selectedFrente].map((f) => {
                  const checked = selectedFormats.some((s) => s.id === f.id);
                  return (
                    <label key={f.id} className={optionClass(checked)}>
                      <input
                        type="checkbox"
                        value={f.id}
                        checked={checked}
                        onChange={() => toggleFormat(f)}
                        className="h-4 w-4 accent-agi-blue"
                      />
                      <span className="flex-1">{f.label}</span>
                      <span className="text-xs tabular-nums text-slate-500">
                        {f.width}×{f.height}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}

          {!carouselMode && selectedFrente && selectedSubtipo && (
            <fieldset className="flex flex-col gap-3">
              <StepTitle step={stepFormatos + 1}>Conteúdo</StepTitle>
              {contentHeader(null)}
              {contentMode === "manual" && (
                <>
                  {(
                    [
                      ["headline", "Título (headline)", false],
                      ["body", "Texto de apoio", true],
                      ["highlight", "Palavra em destaque (fica verde)", false],
                      ["cta", "Texto do botão (CTA)", false],
                    ] as const
                  ).map(([key, label, multiline]) => (
                    <label key={key} className="flex flex-col gap-1 text-sm font-semibold text-agi-blue-dark">
                      {label}
                      {multiline ? (
                        <textarea value={texts[key]} onChange={setText(key)} rows={3} className={fieldClass} />
                      ) : (
                        <input type="text" value={texts[key]} onChange={setText(key)} className={fieldClass} />
                      )}
                    </label>
                  ))}
                  {texts.highlight.trim() &&
                    !texts.body.toLowerCase().includes(texts.highlight.trim().toLowerCase()) && (
                      <p className="text-xs text-slate-500">A palavra em destaque não aparece no texto de apoio.</p>
                    )}
                  <SetaCheckbox
                    checked={texts.ctaArrow}
                    onChange={(ctaArrow) => setTexts((prev) => ({ ...prev, ctaArrow }))}
                  />

                  <div className="flex flex-col gap-1 text-sm font-semibold text-agi-blue-dark">
                    <span>Imagem</span>
                    <label className="flex w-fit cursor-pointer items-center rounded-full border border-agi-blue px-4 py-1.5 text-sm font-semibold text-agi-blue transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-agi-blue hover:bg-agi-blue hover:text-white">
                      {uploadedImage ? "Trocar imagem" : "Escolher imagem"}
                      <input id="upload-imagem" type="file" accept="image/*" onChange={onUpload} className="sr-only" />
                    </label>
                    <span className="text-xs font-normal text-slate-500">
                      Aparece recortada por uma forma irregular em metade da peça.
                    </span>
                    {uploadedImage && (
                      <div className="mt-1 flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={uploadedImage} alt="Imagem enviada" className="h-12 w-12 rounded-md object-cover" />
                        <button
                          type="button"
                          onClick={() => setUploadedImage(null)}
                          className="text-xs font-semibold text-agi-blue underline-offset-2 hover:underline"
                        >
                          Remover imagem
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </fieldset>
          )}

          {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        </div>

        <footer className="border-t border-agi-gray-border px-6 py-4">
          {carouselMode ? (
            <button
              type="button"
              onClick={exportCarousel}
              disabled={slides.length === 0 || exportingCarousel}
              className="w-full rounded-full bg-agi-green px-6 py-3 text-lg font-bold text-agi-blue-dark shadow-md transition-colors hover:bg-agi-green-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-agi-blue disabled:cursor-not-allowed disabled:opacity-50"
            >
              {exportingCarousel
                ? "Exportando…"
                : `Exportar PDF (${slides.length} ${slides.length === 1 ? "página" : "páginas"})`}
            </button>
          ) : (
            <button
              type="button"
              onClick={generate}
              disabled={selectedFormats.length === 0}
              className="w-full rounded-full bg-agi-green px-6 py-3 text-lg font-bold text-agi-blue-dark shadow-md transition-colors hover:bg-agi-green-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-agi-blue disabled:cursor-not-allowed disabled:opacity-50"
            >
              Gerar desdobramento
            </button>
          )}
        </footer>
      </aside>

      <main className="flex-1 overflow-auto bg-agi-gray-bg p-4 sm:p-6 lg:p-10" data-testid="preview">
        {carouselMode ? (
          <CarouselPreview slides={slides} registerStage={registerStage} />
        ) : ctx && selectedFormats.length > 0 ? (
          <div className="flex flex-wrap items-start justify-center gap-10">
            {selectedFormats.map((format) =>
              showVerso ? (
                <div
                  key={`${format.id}:${ctx.audience}:fv`}
                  className="flex flex-wrap items-start justify-center gap-6"
                >
                  {(["frente", "verso"] as const).map((side) => (
                    <FormatArtboard
                      key={side}
                      format={format}
                      ctx={ctx}
                      texts={texts}
                      image={uploadedImage}
                      side={side}
                      run={run}
                      silhouettes={silhouettes}
                    />
                  ))}
                </div>
              ) : (
                <FormatArtboard
                  key={`${format.id}:${ctx.audience}:${ctx.midia}`}
                  format={format}
                  ctx={ctx}
                  texts={texts}
                  image={uploadedImage}
                  run={run}
                  silhouettes={silhouettes}
                />
              ),
            )}
          </div>
        ) : (
          <div className="flex h-full min-h-[50vh] items-center justify-center">
            <p className="max-w-xs text-center text-sm text-slate-500">
              Escolha a frente, o subtipo e um ou mais formatos para ver as pranchetas.
            </p>
          </div>
        )}
        {!carouselMode && run && selectedFormats.length > 0 && (
          <p className="mt-8 text-center text-xs tabular-nums text-slate-400">seed {run.seed}</p>
        )}
      </main>
    </div>
  );
}
