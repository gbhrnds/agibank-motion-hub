// Renderiza o motion quadro a quadro (1920x1080, 24fps, 30s) e codifica em MP4 H.264 via ffmpeg.
// Uso: node projetos/giro-meetup-rh/render.cjs            -> MP4 completo
//      node projetos/giro-meetup-rh/render.cjs --stills 3,7.5,12   -> PNGs de conferência
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const HTML = path.join(__dirname, 'meetup-rh-motion.html');
const OUT = path.join(__dirname, 'giro-meetup-agibank-rh-1920x1080-24fps.mp4');

(async () => {
  const stillsArg = process.argv.indexOf('--stills');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('file://' + HTML + '?autoplay=0');
  await page.evaluate(() => window.__motion.ready);
  const { FPS, DURATION } = await page.evaluate(() => ({ FPS: window.__motion.FPS, DURATION: window.__motion.DURATION }));
  const frame = (t) => page.evaluate((tt) => { window.__motion.render(tt); return window.__motion.canvas.toDataURL('image/png').split(',')[1]; }, t);

  if (stillsArg > -1) {
    const dir = process.argv[stillsArg + 2] || path.join(__dirname, 'stills');
    fs.mkdirSync(dir, { recursive: true });
    for (const s of process.argv[stillsArg + 1].split(',').map(Number)) {
      fs.writeFileSync(path.join(dir, `t${s.toFixed(2)}.png`), Buffer.from(await frame(s), 'base64'));
    }
    await browser.close();
    return;
  }

  const total = Math.round(FPS * DURATION);
  const ff = spawn('ffmpeg', ['-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(FPS),
    '-movflags', '+faststart', '-metadata', 'title=Giro Meetup Agibank RH', OUT], { stdio: ['pipe', 'ignore', 'inherit'] });
  for (let f = 0; f < total; f++) {
    const buf = Buffer.from(await frame(f / FPS), 'base64');
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (f % 48 === 0) process.stdout.write(`\rquadro ${f}/${total}`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  await browser.close();
  console.log(`\nOK ${path.relative(process.cwd(), OUT)}`);
})();
