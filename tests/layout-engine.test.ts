import assert from "node:assert/strict";
import { test } from "node:test";
import { amareloMaxScale, archetype, colorCombos } from "../lib/composition-tokens";
import { allShapeFiles, generateRandomLayout, GENERATED_ARCHETYPES, SHAPE_UNIT, type KeepOutZone } from "../lib/layout-engine";
import { hitsRect, overlaps, silhouetteFromGrid, type Silhouette } from "../lib/shape-silhouette";

// Silhuetas sintéticas: losango (forma irregular o bastante para testar rotação e colisão).
const N = 64;
const diamond = new Uint8Array(N * N);
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) diamond[y * N + x] = Math.abs(x - N / 2 + 0.5) + Math.abs(y - N / 2 + 0.5) <= N / 2 ? 1 : 0;
const silhouettes: Record<string, Silhouette> = Object.fromEntries(
  allShapeFiles.map((f) => [f, silhouetteFromGrid(f, N, diamond, 1, 1)]),
);

// Mesmas áreas da peça: headline, corpo, CTA e área de proteção do logo.
const keepOut: KeepOutZone[] = [
  { label: "Headline", rect: { x: 32, y: 196, width: 445, height: 56 } },
  { label: "Corpo", rect: { x: 32, y: 264, width: 400, height: 60 } },
  { label: "CTA", rect: { x: 32, y: 364, width: 414, height: 58 } },
  { label: "Logo", rect: { x: 5, y: 485, width: 134, height: 110 } },
];

const comboName = (color: string, mode: string) =>
  mode === "stroke" ? `${color}-outline` : color === "amarelo" ? "amarelo-pequeno" : color;
const placed = (s: { file: string; x: number; y: number; scale: number; rotation: number }) => ({
  file: s.file, x: s.x, y: s.y, size: s.scale * SHAPE_UNIT, rotation: s.rotation,
});

test("mesmo seed gera o mesmo layout", () => {
  assert.deepEqual(generateRandomLayout({ keepOut, silhouettes, seed: 42 }), generateRandomLayout({ keepOut, silhouettes, seed: 42 }));
});

test("sorteia só os 3 arquétipos sem foto, todos com frequência relevante", () => {
  const count: Record<string, number> = {};
  for (let seed = 1; seed <= 90; seed++) {
    const l = generateRandomLayout({ keepOut, silhouettes, seed });
    count[l.archetype] = (count[l.archetype] ?? 0) + 1;
  }
  assert.deepEqual(Object.keys(count).sort(), [...GENERATED_ARCHETYPES].sort());
  for (const id of GENERATED_ARCHETYPES) assert.ok(count[id] >= 15, `${id}: ${count[id]}`);
});

for (const id of GENERATED_ARCHETYPES) {
  test(`${id}: contagens, escalas, cores e colisões seguem as regras`, () => {
    const spec = archetype(id);
    for (let seed = 1; seed <= 25; seed++) {
      const l = generateRandomLayout({ keepOut, silhouettes, seed, archetype: id });
      const ranges = spec.shapes
        ? [{ list: l.shapes, r: spec.shapes }]
        : [
            { list: l.shapes.filter((s) => s.role === "protagonista"), r: spec.protagonista! },
            { list: l.shapes.filter((s) => s.role === "coadjuvante"), r: spec.coadjuvantes! },
          ];
      for (const { list, r } of ranges) {
        assert.ok(list.length >= r.count[0] && list.length <= r.count[1], `seed ${seed}: ${list.length} shapes`);
        for (const s of list) assert.ok(s.scale >= r.scale[0] && s.scale <= r.scale[1], `seed ${seed}: scale ${s.scale}`);
      }
      const names = new Set(l.shapes.map((s) => comboName(s.color, s.mode)));
      assert.ok(colorCombos.some((c) => [...names].every((n) => c.includes(n))), `seed ${seed}: ${[...names]}`);
      if (l.shapes.length > 1) assert.ok(names.size >= 2, `seed ${seed}: uma cor só`);
      for (const s of l.shapes) {
        if (s.color === "amarelo") assert.ok(s.scale < amareloMaxScale(), `seed ${seed}: amarelo em scale ${s.scale}`);
        for (const z of keepOut) assert.ok(!hitsRect(silhouettes[s.file], placed(s), z.rect), `seed ${seed}: ${s.file} em ${z.label}`);
      }
      for (let i = 0; i < l.shapes.length; i++)
        for (let j = i + 1; j < l.shapes.length; j++)
          assert.ok(!overlaps(silhouettes[l.shapes[i].file], placed(l.shapes[i]), silhouettes[l.shapes[j].file], placed(l.shapes[j])), `seed ${seed}: sobreposição`);
      if (id === "estouro-de-canto") {
        const hero = l.shapes.find((s) => s.role === "protagonista")!;
        assert.ok(hero.x < 0 || hero.x > 600 || hero.y < 0 || hero.y > 600, `seed ${seed}: centro do protagonista dentro do canvas`);
      }
    }
  });
}
