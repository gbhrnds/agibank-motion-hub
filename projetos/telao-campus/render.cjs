// Renderiza dist/telao-campus.mp4 quadro a quadro (1920x1080, 24fps) a partir do preview.
// Uso: node build.cjs && node render.cjs [--from 0 --to 50 --out arquivo.mp4]
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');

const args = Object.fromEntries(process.argv.slice(2).join(' ').split('--').filter(Boolean)
  .map(s => s.trim().split(/\s+/)));
const html = path.join(__dirname, 'dist/telao-preview.html');
const out = path.resolve(args.out || path.join(__dirname, 'dist/telao-campus.mp4'));

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('file://' + html);
  await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 });
  const { FPS, DURATION } = await page.evaluate(() => ({ FPS: TELAO.FPS, DURATION: TELAO.DURATION }));
  const f0 = Math.round((+args.from || 0) * FPS);
  const f1 = Math.round((args.to != null ? +args.to : DURATION) * FPS);

  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS),
    '-c:v', 'png', '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-tune', 'animation',
    '-pix_fmt', 'yuv420p', '-r', String(FPS), '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });

  await page.evaluate(() => {
    window.__off = document.createElement('canvas');
    window.__off.width = TELAO.W; window.__off.height = TELAO.H;
  });
  const t0 = Date.now();
  for (let f = f0; f < f1; f++) {
    const b64 = await page.evaluate(t => {
      TELAO.render(window.__off.getContext('2d'), t);
      return window.__off.toDataURL('image/png').slice(22);
    }, f / FPS);
    if (!ff.stdin.write(Buffer.from(b64, 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
    if (f % FPS === 0) process.stdout.write(`\r${(f / FPS).toFixed(0)}s / ${(f1 / FPS).toFixed(0)}s`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await browser.close();
  console.log(`\nOK: ${out} em ${((Date.now() - t0) / 1000).toFixed(0)}s`);
})();
