// Embute o caco (forma irregular do KV) e o logo do Programa de Estágio em
// assets.generated.js. Assim player.html funciona até aberto via file:// e as
// cores podem ser controladas pelo CSS.
// Uso: node build-assets.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');
const read = (f) => readFileSync(join(repo, f), 'utf8');

// Caco em outline do KV: só o path; traço e neon vêm do CSS.
const cacoSvg = read('assets_programa_de_estagio/graphics/forma_irregular_01.svg');
const caco = {
  src: 'assets_programa_de_estagio/graphics/forma_irregular_01.svg',
  vb: cacoSvg.match(/viewBox="([^"]+)"/)[1],
  d: cacoSvg.match(/<path[^>]*\sd="([^"]+)"/)[1],
};

// Logo do programa: o export traz contorno preto e o selo "1ª turma" branco
// sobre branco. Normaliza para a versão aplicada no vídeo (branco, selo verde
// com texto azul-escuro, pingo do "i" verde) e usa a Agibank Sans carregada.
const logoSvg = read('assets_programa_de_estagio/logo/logo_programa.svg');
let inner = logoSvg.slice(logoSvg.indexOf('>', logoSvg.indexOf('<svg')) + 1, logoSvg.lastIndexOf('</svg>'));
inner = inner
  .replace(/\s*stroke: #000;\s*stroke-miterlimit: 10;/g, '')
  .replace(/font-family: AgibankSans-Bold, &apos;Agibank Sans&apos;;/g, "font-family: 'Agibank Sans';")
  .replace(/(<rect[^>]*style="fill: )#fff/, '$1#77df40')
  .replace(/style="fill: #fff;( font-family: 'Agibank Sans'; font-size: 90px;)/g, 'style="fill: #000f44;$1')
  .replace(/(<path d="M1076\.35,150\.21[^"]*" style="fill: )#fff/, '$1#77df40');
if (!inner.includes('#77df40') || !inner.includes('#000f44')) throw new Error('Logo do programa mudou; revise build-assets.mjs');
const logo = {
  src: 'assets_programa_de_estagio/logo/logo_programa.svg',
  vb: logoSvg.match(/viewBox="([^"]+)"/)[1],
  inner: inner.trim(),
};

writeFileSync(
  join(here, 'assets.generated.js'),
  `// Gerado por build-assets.mjs a partir de /assets_programa_de_estagio — não edite à mão.\nwindow.AGI_ASSETS = ${JSON.stringify({ caco, logo }, null, 1)};\n`
);
console.log('assets.generated.js: caco + logo do programa');
