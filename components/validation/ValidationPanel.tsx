"use client";

import type { Severity } from "@/lib/contrast-validator";
import type { ValidationItem } from "@/lib/validate-piece";

const SEVERITY_UI: Record<Severity, { icon: string; label: string; className: string }> = {
  ok: { icon: "✅", label: "ok", className: "border-emerald-200 bg-emerald-50 text-emerald-900" },
  warning: { icon: "⚠️", label: "warning", className: "border-amber-200 bg-amber-50 text-amber-900" },
  blocking: { icon: "❌", label: "blocking", className: "border-red-200 bg-red-50 text-red-900" },
};

interface ValidationPanelProps {
  items: ValidationItem[];
  /** false enquanto fontes/assets/layout ainda estão carregando. */
  ready: boolean;
  onExport: () => void;
  showGuides: boolean;
  onToggleGuides: (value: boolean) => void;
}

export default function ValidationPanel({ items, ready, onExport, showGuides, onToggleGuides }: ValidationPanelProps) {
  const blocking = items.filter((i) => i.result.severity === "blocking");
  const warnings = items.filter((i) => i.result.severity === "warning");
  const exportDisabled = !ready || blocking.length > 0;

  return (
    <aside className="flex w-full flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:w-96">
      <header>
        <h2 className="text-lg font-semibold">Validação de marca</h2>
        <p className="text-sm text-slate-500">
          {blocking.length} bloqueio(s) · {warnings.length} aviso(s)
        </p>
      </header>

      <ul className="flex flex-col gap-2" data-testid="validation-list">
        {items.map(({ id, label, result }) => {
          const ui = SEVERITY_UI[result.severity];
          return (
            <li key={id} className={`rounded-lg border px-3 py-2 text-sm ${ui.className}`} data-severity={result.severity}>
              <div className="flex items-center gap-2 font-medium">
                <span aria-hidden>{ui.icon}</span>
                <span className="flex-1">{label}</span>
                <span className="text-xs uppercase tracking-wide opacity-70">{ui.label}</span>
              </div>
              <p className="mt-1 opacity-80">{result.message}</p>
            </li>
          );
        })}
        {!ready && <li className="text-sm text-slate-500">Carregando fontes e assets…</li>}
      </ul>

      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={showGuides} onChange={(e) => onToggleGuides(e.target.checked)} />
        Mostrar área de proteção do logo
      </label>

      <button
        type="button"
        onClick={onExport}
        disabled={exportDisabled}
        className="rounded-lg bg-brand-azulAgibank px-4 py-3 font-semibold text-brand-branco transition hover:bg-brand-azulMedio disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
      >
        Exportar PNG
      </button>
      {blocking.length > 0 && (
        <p className="text-sm text-red-700">Corrija os itens ❌ blocking para liberar o export.</p>
      )}
    </aside>
  );
}
