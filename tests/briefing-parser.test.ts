import assert from "node:assert/strict";
import { test } from "node:test";
import { parseBriefingText, stripLegenda } from "../lib/briefing-parser";
import { temaEvento } from "../lib/theme-config";

const MEETUP = `Redação — Meetup Agibank
Evento: Meetup Agibank

TELA 01: CAPA
Título: Ciência de Dados na prática
Data: 12 de novembro · 19h
CTA: Garanta sua vaga

TELA 02: CONVIDADO
Nome: Ana Souza
Cargo: Head de Dados
Empresa: Agibank
Bio: Lidera o time de ciência de dados,
com foco em modelos de crédito.

TELA 03 - Bruno Lima
Cientista de Dados · Agibank
Trabalha com MLOps e recomendação.

TELA 04: ENCERRAMENTO
CTA: Até o próximo Meetup!
Link: agibank.com.br/meetup

LEGENDA:
Vem aí o Meetup Agibank! #dados #meetup
Inscreva-se pelo link.`;

test("Meetup: telas viram capa, convidados e encerramento; LEGENDA é descartada", () => {
  const r = parseBriefingText(MEETUP, { tema: "meetup" });
  assert.equal(r.kind, "meetup");
  assert.ok(r.ok);
  if (r.kind !== "meetup") return;
  assert.deepEqual(r.slides.map((s) => s.tipo), ["capa", "convidado", "convidado", "encerramento"]);
  const [capa, ana, bruno, fim] = r.slides;
  assert.ok(capa.tipo === "capa" && capa.nomeEvento === "Meetup Agibank" && capa.headline === "Ciência de Dados na prática");
  assert.ok(capa.tipo === "capa" && capa.data === "12 de novembro · 19h" && capa.cta === "Garanta sua vaga" && !capa.seta);
  assert.ok(ana.tipo === "convidado" && ana.nome === "Ana Souza" && ana.cargoEmpresa === "Head de Dados · Agibank");
  assert.ok(ana.tipo === "convidado" && ana.bio === "Lidera o time de ciência de dados, com foco em modelos de crédito.");
  // Tela sem rótulos: nome, cargo/empresa e bio pela ordem das linhas.
  assert.ok(bruno.tipo === "convidado" && bruno.nome === "Bruno Lima" && bruno.cargoEmpresa === "Cientista de Dados · Agibank");
  assert.ok(fim.tipo === "encerramento" && fim.cta === "Até o próximo Meetup!" && fim.link === "agibank.com.br/meetup");
  // Máscaras em round-robin, nenhuma legenda no estado.
  assert.notEqual(ana.tipo === "convidado" && ana.mascaraId, bruno.tipo === "convidado" && bruno.mascaraId);
  assert.ok(temaEvento.mascaras.some((m) => ana.tipo === "convidado" && m.id === ana.mascaraId));
  assert.ok(!JSON.stringify(r).includes("#dados") && !/legenda/i.test(JSON.stringify(r)));
});

test("LEGENDA no meio da redação some até a próxima tela", () => {
  const text = stripLegenda("TELA 01: CAPA\nTítulo: A\nLEGENDA: post #x\nmais legenda\nTELA 02: CONVIDADO\nNome: B");
  assert.ok(!text.includes("#x") && !text.includes("mais legenda") && text.includes("Nome: B"));
});

test("conteúdo simples: rótulos ou ordem das linhas", () => {
  const r = parseBriefingText("Título: Chega de complicar.\nTexto: Organize seus boletos com Pix!\nDestaque: Pix\nCTA: Acesse o app\nLEGENDA: não entra", { tema: null });
  assert.ok(r.kind === "simples" && r.ok);
  if (r.kind !== "simples") return;
  assert.deepEqual(r.texts, { headline: "Chega de complicar.", body: "Organize seus boletos com Pix!", highlight: "Pix", cta: "Acesse o app" });
  const loose = parseBriefingText("Chega de complicar.\nOrganize seus boletos\nem um só lugar.\nAcesse o app", { tema: null });
  assert.ok(loose.kind === "simples" && loose.texts.headline === "Chega de complicar." && loose.texts.cta === "Acesse o app");
});

test("arquivo fora do padrão: ok=false (fallback para o manual)", () => {
  assert.equal(parseBriefingText("Texto solto sem telas.", { tema: "meetup" }).ok, false);
  assert.equal(parseBriefingText("   \n  ", { tema: null }).ok, false);
  assert.equal(parseBriefingText("Oi, segue o material do evento em anexo.", { tema: null }).ok, false);
});

test(".docx (parágrafos separados por linha em branco) mantém a bio inteira", () => {
  const docx = MEETUP.split("\n").join("\n\n");
  const r = parseBriefingText(docx, { tema: "meetup" });
  assert.ok(r.kind === "meetup" && r.ok);
  if (r.kind !== "meetup") return;
  const ana = r.slides[1];
  assert.ok(ana.tipo === "convidado" && ana.bio === "Lidera o time de ciência de dados, com foco em modelos de crédito.");
  assert.deepEqual(r.slides.map((s) => s.tipo), ["capa", "convidado", "convidado", "encerramento"]);
});
