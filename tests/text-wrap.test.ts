import assert from "node:assert/strict";
import { test } from "node:test";
import assetsMap from "../config/assets-map.json";
import { breakIntoLines, preventWidows, wrapWords } from "../lib/text-wrap";

const forbidden = assetsMap.typography.lineBreak.forbiddenTrailingWords;
const BODY = "Organize seus boletos em um só lugar e automatize pagamentos com Pix!";

test("corpo da peça: 'e' no fim da 1ª linha desce para a 2ª", () => {
  assert.deepEqual(
    preventWidows("Organize seus boletos em um só lugar e\nautomatize pagamentos com Pix!", forbidden),
    ["Organize seus boletos em um só lugar", "e automatize pagamentos com Pix!"],
  );
});

test("breakIntoLines: devolve a string com \\n explícito antes do 'e'", () => {
  // Medida por caracteres: a quebra gulosa terminaria a 1ª linha em "e".
  assert.equal(
    breakIntoLines(BODY, 38, (s) => s.length, forbidden),
    "Organize seus boletos em um só lugar\ne automatize pagamentos com Pix!",
  );
});

test("breakIntoLines: texto curto que cabe em uma linha não ganha \\n", () => {
  assert.equal(breakIntoLines("Chega de complicar.", 38, (s) => s.length, forbidden), "Chega de complicar.");
});

test("headline curto em uma linha não muda", () => {
  assert.deepEqual(preventWidows("Chega de complicar.", forbidden), ["Chega de complicar."]);
  assert.deepEqual(preventWidows(["Chega de complicar."], forbidden), ["Chega de complicar."]);
});

test("repete quando a mudança cria nova viúva na mesma linha", () => {
  assert.deepEqual(preventWidows("Vamos juntos para a\ncasa", forbidden), ["Vamos juntos", "para a casa"]);
});

test("normaliza caixa e pontuação; a última linha pode terminar com palavra proibida", () => {
  assert.deepEqual(preventWidows("Ou isso E,\naquilo ou", forbidden), ["Ou isso", "E, aquilo ou"]);
});

test("não esvazia uma linha formada só pela palavra proibida", () => {
  assert.deepEqual(preventWidows("e\ntudo certo", forbidden), ["e", "tudo certo"]);
});

test("wrapWords: quebra por largura e refaz a quebra após descer a palavra", () => {
  const words = BODY.split(" ");
  const lines = wrapWords(words, {
    maxWidth: 38, // em caracteres: a quebra gulosa termina a 1ª linha em "e"
    widthOf: (w) => w.length,
    spaceBefore: () => 1,
    wordOf: (w) => w,
    forbiddenWords: forbidden,
  });
  assert.deepEqual(
    lines.map((l) => l.join(" ")),
    ["Organize seus boletos em um só lugar", "e automatize pagamentos com Pix!"],
  );
});

test("wrapWords: linha que estoura após receber a palavra é quebrada de novo", () => {
  const lines = wrapWords("aaaa bbbb de cccc dddd".split(" "), {
    maxWidth: 12,
    widthOf: (w) => w.length,
    spaceBefore: () => 1,
    wordOf: (w) => w,
    forbiddenWords: forbidden,
  });
  assert.deepEqual(lines.map((l) => l.join(" ")), ["aaaa bbbb", "de cccc dddd"]);
  assert.ok(lines.every((l) => l.join(" ").length <= 12));
});
