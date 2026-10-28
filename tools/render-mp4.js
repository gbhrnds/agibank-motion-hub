// Exporta um motion HTML do hub para MP4, quadro a quadro (render determinístico).
// Uso: node tools/render-mp4.js [entrada.html] [saida.mp4]
// Requer: playwright (com Chromium) e ffmpeg no PATH.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');

const entrada = path.resolve(process.argv[2] || 'charada-jeito-agi.html');
const saida = path.resolve(process.argv[3] || 'renders/charada-jeito-agi.mp4');

(async () => {
  require('fs').mkdirSync(path.dirname(saida), { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => { console.error(e); process.exit(1); });
  await page.goto('file://' + entrada + '?render=1');
  await page.waitForFunction(() => window.pronto === true, null, { timeout: 30000 });
  const { total, fps } = await page.evaluate(() => ({ total: window.TOTAL_FRAMES, fps: window.FPS }));

  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p',
    '-r', String(fps), '-movflags', '+faststart', saida], { stdio: ['pipe', 'inherit', 'inherit'] });
  const fim = new Promise((ok, erro) => ff.on('close', c => c === 0 ? ok() : erro(new Error('ffmpeg saiu com código ' + c))));

  for (let f = 0; f < total; f++) {
    await page.evaluate(f => window.renderFrame(f), f);
    const png = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1920, height: 1080 } });
    if (!ff.stdin.write(png)) await new Promise(r => ff.stdin.once('drain', r));
    if (f % fps === 0) process.stdout.write(`\r${f}/${total} quadros`);
  }
  ff.stdin.end();
  await fim;
  await browser.close();
  console.log(`\r${total}/${total} quadros → ${saida}`);
})();
