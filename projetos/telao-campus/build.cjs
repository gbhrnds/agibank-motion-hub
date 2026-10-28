// Gera dist/telao-preview.html auto-contido (fontes, cacos, logos e fotos em Base64).
// As imagens de campanha ficam em private/ (fora do Git) — ver README.md.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const ASSETS = path.join(ROOT, 'assets');
const PRIVATE = path.join(__dirname, 'private');
const DIST = path.join(__dirname, 'dist');

const dataUrl = (file, mime) => `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;

function readShapes() {
  const shapes = {};
  for (const f of fs.readdirSync(path.join(ASSETS, 'shapes'))) {
    const m = f.match(/^Ativo (\d+)\.svg$/);
    if (!m) continue;
    const svg = fs.readFileSync(path.join(ASSETS, 'shapes', f), 'utf8');
    const [, , , w, h] = svg.match(/viewBox="([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+)"/);
    const d = svg.match(/ d="([^"]+)"/)[1];
    shapes[m[1]] = { w: +w, h: +h, d };
  }
  return shapes;
}

const privateFiles = {
  foto1: 'foto-1.jpg',
  foto2: 'foto-2.jpg',
  logoCampanha: 'logo-campanha.png',
  logoCampanhaNeg: 'logo-campanha-negativo.png',
};
const images = {};
for (const [key, file] of Object.entries(privateFiles)) {
  const p = path.join(PRIVATE, file);
  if (!fs.existsSync(p)) {
    console.error(`Arquivo privado ausente: private/${file} (ver README.md)`);
    process.exit(1);
  }
  images[key] = dataUrl(p, file.endsWith('.png') ? 'image/png' : 'image/jpeg');
}
images.agibank = dataUrl(path.join(ASSETS, 'logos/Agibank_Positivo.svg'), 'image/svg+xml');

const fonts = {};
for (const w of ['Regular', 'Medium', 'Bold']) {
  fonts[w] = dataUrl(path.join(ASSETS, `fonts/AgibankSans-${w}.woff2`), 'font/woff2');
}

const assets = { fonts, images, shapes: readShapes() };
const engine = fs.readFileSync(path.join(__dirname, 'src/telao.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, 'src/player.html'), 'utf8')
  .replace('/*__ASSETS__*/', () => `window.TELAO_ASSETS = ${JSON.stringify(assets)};`)
  .replace('/*__ENGINE__*/', () => engine);

fs.mkdirSync(DIST, { recursive: true });
const out = path.join(DIST, 'telao-preview.html');
fs.writeFileSync(out, html);
console.log(`OK: ${path.relative(process.cwd(), out)} (${(html.length / 1e6).toFixed(2)} MB)`);
