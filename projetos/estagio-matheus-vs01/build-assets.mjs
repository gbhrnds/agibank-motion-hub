// Embute as formas do repositório em assets.generated.js.
// Assim player.html funciona até aberto via file:// (mask-image/fetch de SVG
// seriam bloqueados por CORS) e as cores podem ser trocadas via currentColor.
// Uso: node build-assets.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const assets = join(here, '..', '..', 'assets');

const USED = {
  formaParalelogramo: 'shapes/Ativo 1.svg',
  formaTriangulo: 'shapes/Ativo 5.svg',
  formaLosango: 'shapes/Ativo 9.svg',
  formaFaixa: 'shapes/Ativo 25.svg',
};

const out = {};
for (const [name, file] of Object.entries(USED)) {
  const svg = readFileSync(join(assets, file), 'utf8');
  const vb = svg.match(/viewBox="([^"]+)"/)[1];
  const paths = [...svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1]);
  if (!paths.length) throw new Error(`Nenhum <path> em ${file}`);
  out[name] = { src: `assets/${file}`, vb, paths };
}

writeFileSync(
  join(here, 'assets.generated.js'),
  `// Gerado por build-assets.mjs a partir de /assets — não edite à mão.\nwindow.AGI_ASSETS = ${JSON.stringify(out, null, 1)};\n`
);
console.log(`assets.generated.js: ${Object.keys(out).length} SVGs`);
