import { NextResponse } from "next/server";

// Extração de texto da redação (.docx via mammoth, .pdf via pdf-parse). A interpretação do texto
// (lib/briefing-parser.ts) roda no navegador, onde o usuário revisa antes de aplicar.
export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024;

async function extract(name: string, buffer: Buffer): Promise<string> {
  const ext = name.toLowerCase().split(".").pop();
  if (ext === "docx") {
    const mammoth = await import("mammoth");
    return (await mammoth.extractRawText({ buffer })).value;
  }
  if (ext === "pdf") {
    // Import direto do módulo: o index do pdf-parse tenta ler um PDF de teste ao ser carregado.
    const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;
    return (await pdfParse(buffer)).text;
  }
  if (ext === "txt") return buffer.toString("utf8");
  throw new Error("Formato não suportado: envie .docx ou .pdf.");
}

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Arquivo maior que 10 MB." }, { status: 413 });
  try {
    const text = await extract(file.name, Buffer.from(await file.arrayBuffer()));
    return NextResponse.json({ text });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 422 });
  }
}
