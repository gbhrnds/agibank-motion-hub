// Gera o player auto-contido (meetup-rh-motion.html) a partir de src/template.html,
// embutindo fontes Agibank Sans e SVGs oficiais do repositório em base64/inline.
// Uso: node projetos/giro-meetup-rh/build.cjs
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const A = (...p) => path.join(ROOT, 'assets', ...p);
const read = (p) => fs.readFileSync(p, 'utf8');

const FONTS = {
  bold: 'AgibankSans-Bold.woff2',
  regular: 'AgibankSans-Regular.woff2',
  light: 'AgibankSans-Light.woff2',
};

const LOGOS = {
  agiNeg: 'Agi_Negativo_RGB.svg',
  agiPos: 'Agi_Positivo.svg',
  agibankPos: 'Agibank_Positivo.svg',
};

const SHAPES = ['Ativo 28', 'Ativo 20', 'Ativo 13', 'Ativo 36', 'Ativo 24', 'Ativo 9', 'Ativo 33', 'Ativo 7'];
const MODULES = ['Ativo 65', 'Ativo 66'];
const ICONS = { check: 'Ativo 122', arrow: 'Ativo 127' };

const clean = (s) => s.replace(/<\?xml[^>]*\?>\s*/, '').trim();

// Recorta o viewBox dos logos ao bounding box real do desenho (os SVGs vêm com respiro).
async function cropLogos(svgs) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const out = {};
  for (const [k, svg] of Object.entries(svgs)) {
    await page.setContent(`<body style="margin:0">${svg}</body>`);
    const bb = await page.evaluate(() => {
      const s = document.querySelector('svg');
      s.setAttribute('width', '1000');
      const b = s.getBBox();
      return { x: b.x, y: b.y, w: b.width, h: b.height };
    });
    const vb = `${bb.x.toFixed(2)} ${bb.y.toFixed(2)} ${bb.w.toFixed(2)} ${bb.h.toFixed(2)}`;
    out[k] = svg.replace(/viewBox="[^"]*"/, `viewBox="${vb}"`);
  }
  await browser.close();
  return out;
}

(async () => {
  const fonts = {};
  for (const [k, f] of Object.entries(FONTS)) fonts[k] = fs.readFileSync(A('fonts', f)).toString('base64');

  const rawLogos = {};
  for (const [k, f] of Object.entries(LOGOS)) rawLogos[k] = clean(read(A('logos', f)));
  const logos = await cropLogos(rawLogos);

  const shapes = {};
  for (const s of SHAPES) shapes[s] = clean(read(A('shapes', `${s}.svg`)));
  const modules = {};
  for (const m of MODULES) modules[m] = clean(read(A('modulos', `${m}.svg`)));
  const icons = {};
  for (const [k, f] of Object.entries(ICONS)) icons[k] = clean(read(A('icons', `${f}.svg`)));

  const assets = { fonts, logos, shapes, modules, icons };
  const tpl = read(path.join(__dirname, 'src', 'template.html'));
  const html = tpl.replace('/*__ASSETS__*/null', () => JSON.stringify(assets));
  const out = path.join(__dirname, 'meetup-rh-motion.html');
  fs.writeFileSync(out, html);
  console.log(`OK ${path.relative(ROOT, out)} (${(html.length / 1024).toFixed(0)} KB)`);
})();
