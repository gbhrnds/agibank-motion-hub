"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { localMirror, logoPath, pickLogoKey, shapePath } from "@/lib/brand-tokens";
import { MENU_CONFIG, pieceContext, type FormatSpec, type FrenteId } from "@/lib/format-config";
import { allShapeFiles, pickPieceRun, type PieceRun } from "@/lib/layout-engine";
import { loadSilhouette, type Silhouette } from "@/lib/shape-silhouette";

const FormatArtboard = dynamic(() => import("@/components/canvas/FormatArtboard"), { ssr: false });

/** Fundo da peça base (lib/piece-spec.ts → buildLayers). */
const BACKGROUND = "azulAgibank" as const;
/** Logo da interface: Agi reduzido (uso interno), versão positiva sobre o branco da barra lateral. */
const UI_LOGO = logoPath(pickLogoKey("interno", "fundoBranco", "digital"));

function StepTitle({ step, children }: { step: number; children: React.ReactNode }) {
  return (
    <legend className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-agi-blue text-[10px] text-white">{step}</span>
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

export default function Page() {
  const [selectedFrente, setSelectedFrente] = useState<FrenteId | null>(null);
  const [selectedSubtipo, setSelectedSubtipo] = useState<string | null>(null);
  const [selectedFormats, setSelectedFormats] = useState<FormatSpec[]>([]);
  const [run, setRun] = useState<PieceRun | null>(null);
  const [silhouettes, setSilhouettes] = useState<Record<string, Silhouette> | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Silhuetas de todos os shapes do assets-map.json (usadas pelo motor para evitar textos e logo).
  useEffect(() => {
    Promise.all(allShapeFiles.map((f) => loadSilhouette(f, shapePath(f))))
      .then((list) => setSilhouettes(Object.fromEntries(list.map((s) => [s.file, s]))))
      .catch((err) => setError(String(err instanceof Error ? err.message : err)));
  }, []);

  // Primeiro estado global já sorteado: as pranchetas aparecem completas assim que o formato é marcado.
  useEffect(() => setRun(pickPieceRun(BACKGROUND)), []);

  const ctx = useMemo(
    () => (selectedFrente && selectedSubtipo ? pieceContext(selectedFrente, selectedSubtipo) : null),
    [selectedFrente, selectedSubtipo],
  );

  const chooseFrente = useCallback((id: FrenteId) => {
    setSelectedFrente(id);
    setSelectedSubtipo(null);
    setSelectedFormats([]);
  }, []);

  const toggleFormat = useCallback((format: FormatSpec) => {
    setSelectedFormats((prev) => {
      const next = prev.some((f) => f.id === format.id) ? prev.filter((f) => f.id !== format.id) : [...prev, format];
      // Mantém a ordem do menu.
      const order = selectedFrente ? MENU_CONFIG.formatos[selectedFrente].map((f) => f.id) : [];
      return next.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    });
  }, [selectedFrente]);

  const generate = useCallback(() => setRun(pickPieceRun(BACKGROUND)), []);

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
                      onChange={() => setSelectedSubtipo(s.id)}
                      className="h-4 w-4 accent-agi-blue"
                    />
                    {s.label}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {selectedFrente && selectedSubtipo && (
            <fieldset>
              <StepTitle step={3}>Formatos</StepTitle>
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

          {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        </div>

        <footer className="border-t border-agi-gray-border px-6 py-4">
          <button
            type="button"
            onClick={generate}
            disabled={selectedFormats.length === 0}
            className="w-full rounded-full bg-agi-green px-6 py-3 text-lg font-bold text-agi-blue-dark shadow-md transition-colors hover:bg-agi-green-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-agi-blue disabled:cursor-not-allowed disabled:opacity-50"
          >
            Gerar desdobramento
          </button>
        </footer>
      </aside>

      <main className="flex-1 overflow-auto bg-agi-gray-bg p-4 sm:p-6 lg:p-10" data-testid="preview">
        {ctx && selectedFormats.length > 0 ? (
          <div className="flex flex-wrap items-start justify-center gap-10">
            {selectedFormats.map((format) => (
              <FormatArtboard
                key={`${format.id}:${ctx.audience}:${ctx.midia}`}
                format={format}
                ctx={ctx}
                run={run}
                silhouettes={silhouettes}
              />
            ))}
          </div>
        ) : (
          <div className="flex h-full min-h-[50vh] items-center justify-center">
            <p className="max-w-xs text-center text-sm text-slate-500">
              Escolha a frente, o subtipo e um ou mais formatos para ver as pranchetas.
            </p>
          </div>
        )}
        {run && selectedFormats.length > 0 && (
          <p className="mt-8 text-center text-xs tabular-nums text-slate-400">seed {run.seed}</p>
        )}
      </main>
    </div>
  );
}
