import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agibank Brand Studio",
  description: "Gerador de peças de Comunicação Interna — Alerta institucional 600x600",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-slate-100 font-brand text-slate-900 antialiased">{children}</body>
    </html>
  );
}
