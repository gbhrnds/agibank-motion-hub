import assert from "node:assert/strict";
import { test } from "node:test";
import { novaCapa, novoConvidado, proximaMascara, type Slide } from "../lib/carousel";
import { CMYK_TABLE, convertCanvasToCMYKBuffer, hexToRgb, rgbToCmyk } from "../lib/color-cmyk";
import { colors } from "../lib/brand-tokens";
import { temaEvento } from "../lib/theme-config";

test("fórmula RGB→CMYK", () => {
  assert.deepEqual(rgbToCmyk(255, 255, 255), [0, 0, 0, 0]);
  assert.deepEqual(rgbToCmyk(0, 0, 0), [0, 0, 0, 1]);
  const [c, m, y, k] = rgbToCmyk(...hexToRgb(colors.azulAgibank));
  assert.equal(Math.round(c * 100), 100);
  assert.equal(Math.round(m * 100), 59);
  assert.equal(Math.round(y * 100), 0);
  assert.equal(Math.round(k * 100), 4);
});

test("pixels das cores da marca usam a tabela central; demais, a fórmula", () => {
  const [r, g, b] = hexToRgb(colors.verde);
  const px = new Uint8ClampedArray([r, g, b, 255, 10, 200, 30, 255]);
  const out = convertCanvasToCMYKBuffer(px);
  assert.deepEqual([...out.slice(0, 4)], CMYK_TABLE.verde.map((v) => Math.round(v * 255)));
  assert.deepEqual([...out.slice(4, 8)], rgbToCmyk(10, 200, 30).map((v) => Math.round(v * 255)));
});

test("convidados alternam a máscara (round-robin) e nunca repetem a do anterior", () => {
  let slides: Slide[] = [novaCapa()];
  for (let i = 0; i < 9; i++) slides = [...slides, novoConvidado(slides)];
  const ids = slides.flatMap((s) => (s.tipo === "convidado" ? [s.mascaraId] : []));
  assert.equal(new Set(ids.slice(0, temaEvento.mascaras.length)).size, temaEvento.mascaras.length);
  ids.slice(1).forEach((id, i) => assert.notEqual(id, ids[i]));
  assert.equal(proximaMascara([novaCapa()]), temaEvento.mascaras[0].id);
});
