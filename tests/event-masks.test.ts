import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { novaCapa, novoConvidado, novoEncerramento, trocarTipo, type Slide } from "../lib/carousel";
import { getCoverFit } from "../lib/image-mask";
import { fitShape, parseShapeSvg } from "../lib/shape-mask";
import { allShapeFiles } from "../lib/layout-engine";
import { temaEvento } from "../lib/theme-config";

test("cover fit: retrato, paisagem e quadrada cobrem a caixa inteira sem distorcer", () => {
  const box = { w: 740, h: 720 };
  for (const [w, h] of [
    [600, 1800],
    [2400, 800],
    [1000, 1000],
  ]) {
    const { scale, x, y } = getCoverFit(w, h, box.w, box.h);
    // Escala única nos dois eixos (sem distorção) e a imagem cobre os 4 lados da caixa.
    assert.ok(x <= 1e-9 && y <= 1e-9);
    assert.ok(x + w * scale >= box.w - 1e-9 && y + h * scale >= box.h - 1e-9);
    // Um dos eixos encosta exatamente (corta só o excesso do outro) e o corte é centralizado.
    assert.ok(Math.abs(w * scale - box.w) < 1e-6 || Math.abs(h * scale - box.h) < 1e-6);
    assert.ok(Math.abs(x + (w * scale - box.w) / 2) < 1e-6 && Math.abs(y + (h * scale - box.h) / 2) < 1e-6);
  }
});

test("máscaras do tema Evento são shapes reais do repositório", () => {
  for (const m of temaEvento.mascaras) {
    assert.ok(allShapeFiles.includes(m.arquivo), `${m.arquivo} fora de assets-map shapes.byType`);
    const shape = parseShapeSvg(m.arquivo, readFileSync(`assets/shapes/${m.arquivo}`, "utf8"));
    assert.ok(shape.d.length > 20 && shape.width > 0 && shape.height > 0);
    // Encaixe com escala única, dentro da caixa.
    const fit = fitShape(shape, { x: 380, y: -40, width: 740, height: 720 });
    assert.ok(fit.bounds.width <= 740 + 1e-6 && fit.bounds.height <= 720 + 1e-6);
    assert.ok(Math.abs(fit.bounds.width / fit.bounds.height - shape.width / shape.height) < 1e-9);
  }
});

test("CTA sem seta por padrão; trocar o tipo da tela mantém o card", () => {
  const capa = novaCapa();
  const fim = novoEncerramento();
  assert.equal(capa.tipo === "capa" && capa.seta, false);
  assert.equal(fim.tipo === "encerramento" && fim.seta, false);
  let slides: Slide[] = [capa];
  const tela = novoConvidado(slides);
  slides = [...slides, tela];
  slides = trocarTipo(slides, tela.id, "encerramento");
  assert.equal(slides[1].id, tela.id);
  assert.equal(slides[1].tipo, "encerramento");
  slides = trocarTipo(slides, tela.id, "convidado");
  assert.equal(slides[1].tipo, "convidado");
  // A capa nunca muda de tipo.
  assert.deepEqual(trocarTipo(slides, capa.id, "convidado")[0], capa);
});
