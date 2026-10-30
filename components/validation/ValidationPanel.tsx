"use client";

import type { Severity } from "@/lib/contrast-validator";
import type { ValidationItem } from "@/lib/validate-piece";

const SEVERITY_UI: Record<Severity, { icon: string; label: string; className: string }> = {
  ok: { icon: "✅", label: "ok", className: "bg-green-50 text-green-800 border border-green-200" },
  warning: { icon: "⚠️", label: "aviso", className: "bg-yellow-50 text-yellow-800 border border-yellow-200" },
  blocking: { icon: "❌", label: "bloqueia", className: "bg-red-50 text-red-700 border border-red-200" },
};

/** Ordem de exibição: o que bloqueia primeiro. */
const ORDER: Record<Severity, number> = { blocking: 0, warning: 1, ok: 2 };

interface ValidationPanelProps {
  items: ValidationItem[];
  /** false enquanto fontes/assets/layout ainda estão carregando. */
  ready: boolean;
}

/** Resultado das validações de marca. Qualquer item "bloqueia" trava a exportação. */
export default function ValidationPanel({ items, ready }: ValidationPanelProps) {
  const count = (s: Severity) => items.filter((i) => i.result.severity === s).length;
  const blocking = count("blocking");
  const sorted = [...items].sort((a, b) => ORDER[a.result.severity] - ORDER[b.result.severity]);

  return (
    <section className="rounded-xl border border-agi-gray-border bg-white p-4 shadow-sm" aria-labelledby="validation-title">
      <header className="mb-3">
        <h2 id="validation-title" className="text-base font-bold text-agi-blue-dark">
          Validação de marca
        </h2>
        {ready ? (
          <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-semibold tabular-nums">
            <span className={`rounded-full px-2 py-0.5 ${blocking ? "bg-red-100 text-red-700" : "bg-agi-gray-bg text-slate-500"}`}>
              {blocking} bloqueio(s)
            </span>
            <span className={`rounded-full px-2 py-0.5 ${count("warning") ? "bg-yellow-100 text-yellow-800" : "bg-agi-gray-bg text-slate-500"}`}>
              {count("warning")} aviso(s)
            </span>
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-800">{count("ok")} ok</span>
          </div>
        ) : (
          <p className="mt-1 text-xs text-slate-500">Carregando…</p>
        )}
      </header>

      <ul data-testid="validation-list">
        {sorted.map(({ id, label, result }) => {
          const ui = SEVERITY_UI[result.severity];
          // Itens ok ficam compactos; avisos e bloqueios ganham destaque.
          const compact = result.severity === "ok";
          return (
            <li
              key={id}
              className={`mb-2 rounded-lg text-sm ${compact ? "px-3 py-2" : "p-3"} ${ui.className}`}
              data-severity={result.severity}
            >
              <div className="flex items-center gap-2 font-semibold">
                <span aria-hidden>{ui.icon}</span>
                <span className="min-w-0 flex-1">{label}</span>
                {!compact && <span className="text-[10px] uppercase tracking-wider opacity-70">{ui.label}</span>}
              </div>
              <p className={`leading-snug opacity-90 ${compact ? "mt-0.5 pl-6 text-xs" : "mt-1"}`}>{result.message}</p>
            </li>
          );
        })}
        {!ready && <li className="text-sm text-slate-500">Carregando fontes e assets…</li>}
      </ul>
    </section>
  );
}
