// Renderiza os letterings quadro a quadro (PNG com alfa) e aplica sobre o vídeo.
// Uso:
//   node render.mjs <video.mp4> [saida.mp4] [--cues cues.json] [--preview t1,t2,...]
// --cues    usa os ajustes exportados do player.html
// --preview só gera stills (render/preview-<t>.jpg) dos tempos indicados
// --trecho  a,b gera só um clipe de prévia entre os segundos a e b (render/trecho-a-b.mp4)
// --alpha   também exporta só os letterings em .mov RGB+alpha, com a duração
//           total do vídeo (começa em 00:00, é só soltar sobre o vídeo na timeline):
//           prores = ProRes 4444 com alfa · animation = QuickTime Animation (sem perda) · ambos
import { createServer } from 'node:http';
import { readFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, extname } from 'node:path';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(join(execFileSync('npm', ['root', '-g']).toString().trim(), 'playwright'))); }

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..', '..');
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : null; };
const cuesFile = opt('--cues');
const preview = opt('--preview');
const alpha = opt('--alpha');
const trecho = opt('--trecho')?.split(',').map(Number);
if (alpha && !['prores', 'animation', 'ambos'].includes(alpha)) { console.error('--alpha deve ser prores, animation ou ambos'); process.exit(1); }
const [video, saida = join(here, 'render', 'MONTAGEM_VS01_letterings.mp4')] = args;
if (!video) { console.error('Uso: node render.mjs <video.mp4> [saida.mp4] [--cues cues.json] [--preview t1,t2]'); process.exit(1); }

const FPS_NUM = 24000, FPS_DEN = 1001;
const probe = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate,width,height', '-of', 'csv=p=0', video]).toString().trim();
const [w, h, rate] = probe.split(',');
if (rate !== `${FPS_NUM}/${FPS_DEN}` || w !== '1920' || h !== '1080') console.warn(`Aviso: vídeo ${w}x${h} @ ${rate}; o overlay assume 1920x1080 @ 23,976.`);

// Servidor estático da raiz do repositório (fontes via http evitam bloqueio de file://).
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const server = createServer((req, res) => {
  const p = join(repo, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(repo) || !existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' });
  res.end(readFileSync(p));
}).listen(0);
const port = server.address().port;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(`http://127.0.0.1:${port}/projetos/estagio-matheus-vs01/overlay.html`);
await page.waitForFunction(() => window.ready === true);
if (cuesFile) await page.evaluate((o) => window.setCues(o), JSON.parse(readFileSync(cuesFile, 'utf8')));

const out = join(here, 'render');
mkdirSync(out, { recursive: true });

if (preview) {
  for (const t of preview.split(',').map(Number)) {
    const n = Math.round(t * FPS_NUM / FPS_DEN);
    const ts = n * FPS_DEN / FPS_NUM;
    await page.evaluate((x) => window.renderAt(x), ts);
    await page.screenshot({ path: join(out, 'ov.png'), omitBackground: true });
    const jpg = join(out, `preview-${t.toFixed(2)}.jpg`);
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(ts), '-i', video, '-i', join(out, 'ov.png'),
      '-filter_complex', '[0:v][1:v]overlay', '-frames:v', '1', '-q:v', '3', jpg]);
    console.log(jpg);
  }
} else {
  const [a, b] = trecho || await page.evaluate(() => window.cueSpan());
  const n0 = Math.floor(a * FPS_NUM / FPS_DEN), n1 = Math.ceil(b * FPS_NUM / FPS_DEN);
  const frames = join(out, 'frames');
  rmSync(frames, { recursive: true, force: true });
  mkdirSync(frames);
  for (let n = n0; n <= n1; n++) {
    // Tempo exato do quadro n do vídeo, para o lettering casar com a fala.
    await page.evaluate((x) => window.renderAt(x), n * FPS_DEN / FPS_NUM);
    await page.screenshot({ path: join(frames, `${String(n).padStart(6, '0')}.png`), omitBackground: true });
    if ((n - n0) % 100 === 0) console.log(`quadro ${n - n0}/${n1 - n0}`);
  }
  const destino = trecho ? join(out, `trecho-${a}-${b}.mp4`) : saida;
  console.log('compondo com ffmpeg…');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', video,
    '-framerate', `${FPS_NUM}/${FPS_DEN}`, '-start_number', String(n0), '-i', join(frames, '%06d.png'),
    '-filter_complex', `[1:v]setpts=PTS-STARTPTS+${n0}*${FPS_DEN}/${FPS_NUM}/TB[ov];[0:v][ov]overlay=eof_action=pass,format=yuv420p[v]`,
    ...(trecho ? ['-ss', String(a), '-to', String(b)] : []),
    '-map', '[v]', '-map', '0:a?', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16',
    ...(trecho ? ['-c:a', 'aac', '-b:a', '192k'] : ['-c:a', 'copy']), '-movflags', '+faststart', destino],
    { stdio: 'inherit' });
  console.log(destino);

  if (alpha && !trecho) {
    const dur = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', video]).toString().trim();
    const codecs = {
      prores: ['-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le', '-alpha_bits', '16', '-vendor', 'apl0'],
      animation: ['-c:v', 'qtrle', '-pix_fmt', 'argb'],
    };
    for (const tipo of alpha === 'ambos' ? ['prores', 'animation'] : [alpha]) {
      const mov = join(out, `MONTAGEM_VS01_letterings_alpha_${tipo === 'prores' ? 'ProRes4444' : 'Animation'}.mov`);
      console.log(`exportando ${mov}…`);
      execFileSync('ffmpeg', ['-v', 'error', '-y',
        '-f', 'lavfi', '-i', `color=c=black@0.0:s=1920x1080:r=${FPS_NUM}/${FPS_DEN}:d=${dur},format=rgba`,
        '-framerate', `${FPS_NUM}/${FPS_DEN}`, '-start_number', String(n0), '-i', join(frames, '%06d.png'),
        '-filter_complex', `[1:v]format=rgba,setpts=PTS-STARTPTS+${n0}*${FPS_DEN}/${FPS_NUM}/TB[ov];[0:v][ov]overlay=eof_action=pass:format=auto:alpha=straight[v]`,
        '-map', '[v]', ...codecs[tipo], '-timecode', '00:00:00:00', mov], { stdio: 'inherit' });
      console.log(mov);
    }
  }
}
await browser.close();
server.close();
