import assert from "node:assert/strict";
import { test } from "node:test";
import { alignments, archetype, archetypeIds, ctaStyles, shapePalettes } from "../lib/composition-tokens";
import {
  AMARELO_MAX_SCALE,
  allShapeFiles,
  generateRandomLayout,
  SCALE_BY_ROLE,
  SHAPE_UNIT,
  type KeepOutZone,
  type PieceLayout,
} from "../lib/layout-engine";
import { gapBetween, hitsRect, silhouetteFromGrid, type Silhouette } from "../lib/shape-silhouette";

// Silhuetas sintéticas: quadrado com um canto cortado (cheio como os shapes reais, mas não simétrico).
const N = 64;
const shape = new Uint8Array(N * N);
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) shape[y * N + x] = x + y < N * 1.5 ? 1 : 0;
const silhouettes: Record<string, Silhouette> = Object.fromEntries(
  allShapeFiles.map((f) => [f, silhouetteFromGrid(f, N, shape, 1, 1)]),
);

// Áreas da peça por alinhamento (textos, CTA, área de proteção do logo).
const keepOutFor = (p: Pick<PieceLayout, "alignment">): KeepOutZone[] =>
  p.alignment === "center"
    ? [
        { label: "Headline", rect: { x: 45, y: 196, width: 510, height: 56 } },
        { label: "Corpo", rect: { x: 100, y: 264, width: 400, height: 60 } },
        { label: "CTA", rect: { x: 93, y: 364, width: 414, height: 58 } },
        { label: "Logo", rect: { x: 233, y: 485, width: 134, height: 110 } },
      ]
    : [
        { label: "Headline", rect: { x: 32, y: 196, width: 510, height: 56 } },
        { label: "Corpo", rect: { x: 32, y: 264, width: 400, height: 60 } },
        { label: "CTA", rect: { x: 32, y: 364, width: 414, height: 58 } },
        { label: "Logo", rect: { x: 5, y: 485, width: 134, height: 110 } },
      ];
const opts = { background: "azulAgibank" as const, silhouettes, keepOutFor };
const placed = (s: { file: string; x: number; y: number; scale: number; rotation: number }) => ({
  file: s.file, x: s.x, y: s.y, size: s.scale * SHAPE_UNIT, rotation: s.rotation,
});

test("mesmo seed gera a mesma composição", () => {
  assert.deepEqual(generateRandomLayout({ ...opts, seed: 7 }), generateRandomLayout({ ...opts, seed: 7 }));
});

test("sorteia alinhamento, CTA, arquétipo e paleta entre as opções do JSON", () => {
  const seen = { alignment: new Set<string>(), cta: new Set<string>(), archetype: new Set<string>(), palette: new Set<string>() };
  for (let seed = 1; seed <= 60; seed++) {
    const p = generateRandomLayout({ ...opts, seed });
    seen.alignment.add(p.alignment);
    seen.cta.add(p.ctaStyle);
    seen.archetype.add(p.shapeArchetype);
    seen.palette.add(p.shapePalette.name);
  }
  assert.deepEqual([...seen.alignment].sort(), [...alignments].sort());
  assert.deepEqual([...seen.cta].sort(), [...ctaStyles].sort());
  assert.deepEqual([...seen.archetype].sort(), [...archetypeIds].sort());
  assert.deepEqual([...seen.palette].sort(), shapePalettes("azulAgibank").map((p) => p.name).sort());
});

for (const id of archetypeIds) {
  test(`${id}: contagem, hierarquia de escala, paleta fechada e colisões`, () => {
    let generated = 0;
    for (let seed = 1; seed <= 12; seed++) {
      let p: PieceLayout;
      try {
        p = generateRandomLayout({ ...opts, seed, archetype: id });
      } catch {
        continue; // sem encaixe para esse seed: no uso normal o motor troca de arquétipo
      }
      generated++;
      const n = p.shapes.length;
      const count = id === "mosaico-hierarquico" ? [3, 4] : archetype(id).count;
      assert.ok(n >= count[0] && n <= count[1], `seed ${seed}: ${n} shapes`);
      for (const s of p.shapes) {
        const r = SCALE_BY_ROLE[s.role];
        assert.ok(s.scale >= r[0] && s.scale <= r[1], `seed ${seed}: ${s.role} scale ${s.scale}`);
        assert.ok(p.shapePalette.colors.includes(s.color), `seed ${seed}: ${s.color} fora de ${p.shapePalette.name}`);
        if (s.color === "amarelo") assert.ok(s.scale < AMARELO_MAX_SCALE, `seed ${seed}: amarelo grande`);
        for (const z of keepOutFor(p)) assert.ok(!hitsRect(silhouettes[s.file], placed(s), z.rect), `seed ${seed}: ${s.file} em ${z.label}`);
      }
      for (let i = 0; i < n; i++)
        for (let j = i + 1; j < n; j++)
          assert.ok(gapBetween(silhouettes[p.shapes[i].file], placed(p.shapes[i]), silhouettes[p.shapes[j].file], placed(p.shapes[j])) > 0, `seed ${seed}: sobreposição`);
      if (id === "estouro-solitario") {
        const s = p.shapes[0];
        assert.ok(s.x < 0 || s.x > 600 || s.y < 0 || s.y > 600, `seed ${seed}: centro dentro do canvas`);
      }
      if (id === "mosaico-hierarquico") {
        const hero = p.shapes.find((s) => s.role === "protagonista")!;
        const medio = p.shapes.find((s) => s.role === "medio")!;
        const g = gapBetween(silhouettes[hero.file], placed(hero), silhouettes[medio.file], placed(medio));
        assert.ok(g <= 0.05 * medio.scale * SHAPE_UNIT + 4, `seed ${seed}: médio a ${g.toFixed(1)}px do protagonista`);
      }
    }
    // No uso normal, um arquétipo sem encaixe cai para outro. Com a forma sintética o mosaico encaixa
    // menos que com os SVGs reais (~92% medido no navegador); exigimos ao menos ~70%.
    assert.ok(generated >= 8, `${id}: só ${generated}/12 seeds geraram`);
  });
}
