import assert from "node:assert/strict";
import { test } from "node:test";
import compositionPatterns from "../config/composition-patterns.json";
import { preventWidows, wrapWords } from "../lib/text-wrap";

const forbidden = compositionPatterns.typographyLineBreakRules.forbiddenTrailingWords;
const { incorrect, correct } = compositionPatterns.typographyLineBreakRules.example;

test("corrige o exemplo do composition-patterns.json", () => {
  assert.deepEqual(preventWidows(incorrect, forbidden), correct.split("\n"));
});

test("corpo da peça: 'e' no fim da 1ª linha desce para a 2ª", () => {
  assert.deepEqual(
    preventWidows("Organize seus boletos em um só lugar e\nautomatize pagamentos com o Pix!", forbidden),
    ["Organize seus boletos em um só lugar", "e automatize pagamentos com o Pix!"],
  );
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
  const words = "Organize seus boletos em um só lugar e automatize pagamentos com o Pix!".split(" ");
  const lines = wrapWords(words, {
    maxWidth: 38, // em caracteres: a quebra gulosa termina a 1ª linha em "e"
    widthOf: (w) => w.length,
    spaceBefore: () => 1,
    wordOf: (w) => w,
    forbiddenWords: forbidden,
  });
  assert.deepEqual(
    lines.map((l) => l.join(" ")),
    ["Organize seus boletos em um só lugar", "e automatize pagamentos com o Pix!"],
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
