/*
 * Vídeo Telão Campus — motor de animação (Canvas 2D, determinístico).
 * Cada frame é uma função pura de t (segundos), o que permite tocar no
 * navegador, exportar via MediaRecorder e renderizar quadro a quadro em MP4.
 */
(function () {
  const W = 1920, H = 1080, FPS = 24, DURATION = 53;
  const C = {
    blue: '#0064f5', mid: '#0033b0', navy: '#000f44', yellow: '#ffd600',
    lime: '#C9FF90', white: '#ffffff', gray: '#f3f3f3',
  };
  const FONT = 'Agibank Sans';
  const RADIUS = 15; // cantos arredondados dos módulos/máscaras (12–17px)
  const MARGIN = 120;

  // ---------- easing / tempo ----------
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const easeOut = k => 1 - Math.pow(1 - k, 3);
  const easeInOut = k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  const easeOutQuint = k => 1 - Math.pow(1 - k, 5);
  const prog = (t, a, b, ease = easeOut) => ease(clamp((t - a) / (b - a)));
  // entra em [a, a+inDur], sai em [b-outDur, b]
  const life = (t, a, inDur, b, outDur) =>
    Math.min(prog(t, a, a + inDur), 1 - prog(t, b - outDur, b, easeInOut));

  function rng(seed) {
    return () => {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let r = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- formas irregulares (cacos) ----------
  // Converte o path SVG do caco em polígono: cada segmento longo vira uma aresta,
  // e os vértices são as interseções entre arestas consecutivas. Assim o caco
  // mantém a proporção original e os cantos podem ser refeitos com raio fixo.
  function parsePath(d) {
    const tokens = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g);
    const segs = [];
    let i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0;
    const num = () => parseFloat(tokens[i++]);
    while (i < tokens.length) {
      if (/[a-zA-Z]/.test(tokens[i])) cmd = tokens[i++];
      const rel = cmd === cmd.toLowerCase();
      const ox = rel ? x : 0, oy = rel ? y : 0;
      let nx = x, ny = y;
      switch (cmd.toUpperCase()) {
        case 'M': nx = ox + num(); ny = oy + num(); sx = nx; sy = ny; cmd = rel ? 'l' : 'L'; x = nx; y = ny; continue;
        case 'L': nx = ox + num(); ny = oy + num(); break;
        case 'H': nx = (rel ? x : 0) + num(); break;
        case 'V': ny = (rel ? y : 0) + num(); break;
        case 'C': i += 4; nx = ox + num(); ny = oy + num(); break;
        case 'S': case 'Q': i += 2; nx = ox + num(); ny = oy + num(); break;
        case 'Z': nx = sx; ny = sy; break;
        default: throw new Error('Comando SVG não suportado: ' + cmd);
      }
      if (nx !== x || ny !== y) segs.push([x, y, nx, ny]);
      x = nx; y = ny;
    }
    return segs;
  }

  function polygonFromPath(d, vbW, vbH) {
    const segs = parsePath(d);
    const maxDim = Math.max(vbW, vbH);
    const edges = segs.filter(s => Math.hypot(s[2] - s[0], s[3] - s[1]) > maxDim * 0.12);
    const pts = [];
    for (let k = 0; k < edges.length; k++) {
      const a = edges[k], b = edges[(k + 1) % edges.length];
      const d1x = a[2] - a[0], d1y = a[3] - a[1], d2x = b[2] - b[0], d2y = b[3] - b[1];
      const den = d1x * d2y - d1y * d2x;
      if (Math.abs(den) < 1e-6) continue;
      const u = ((b[0] - a[0]) * d2y - (b[1] - a[1]) * d2x) / den;
      pts.push([a[0] + d1x * u, a[1] + d1y * u]);
    }
    // normaliza para caixa 0..1 mantendo proporção (usa o maior lado)
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const minX = Math.min(...xs), minY = Math.min(...ys);
    const w = Math.max(...xs) - minX, h = Math.max(...ys) - minY;
    return { pts: pts.map(p => [(p[0] - minX) / w, (p[1] - minY) / h]), aspect: w / h };
  }

  // Desenha polígono com cantos arredondados (raio em px de tela).
  function roundedPoly(ctx, pts, r) {
    const n = pts.length;
    ctx.beginPath();
    for (let k = 0; k < n; k++) {
      const p0 = pts[(k - 1 + n) % n], p1 = pts[k], p2 = pts[(k + 1) % n];
      const l1 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
      const l2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
      const rr = Math.min(r, l1 * 0.45, l2 * 0.45);
      const ax = p1[0] + (p0[0] - p1[0]) * (rr / l1), ay = p1[1] + (p0[1] - p1[1]) * (rr / l1);
      if (k === 0) ctx.moveTo(ax, ay); else ctx.lineTo(ax, ay);
      ctx.arcTo(p1[0], p1[1], p2[0], p2[1], rr);
    }
    ctx.closePath();
  }

  // Caco posicionado: centro (cx, cy), largura w, rotação rot (graus), escala s.
  function cacoPoints(shape, cx, cy, w, rot = 0, s = 1, flip = false) {
    const h = w / shape.aspect;
    const a = (rot * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
    return shape.pts.map(([u, v]) => {
      const x = ((flip ? 1 - u : u) - 0.5) * w * s, y = (v - 0.5) * h * s;
      return [cx + x * ca - y * sa, cy + x * sa + y * ca];
    });
  }

  function fillCaco(ctx, shape, o) {
    const pts = cacoPoints(shape, o.x, o.y, o.w, o.rot, o.s ?? 1, o.flip);
    roundedPoly(ctx, pts, o.r ?? RADIUS);
    ctx.globalAlpha = o.alpha ?? 1;
    if (o.outline) {
      ctx.lineWidth = o.outline; ctx.lineJoin = 'round';
      ctx.strokeStyle = o.color; ctx.stroke();
    } else {
      ctx.fillStyle = o.color; ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Foto recortada dentro de um caco (cover + Ken Burns sutil).
  function photoCaco(ctx, img, shape, o) {
    const pts = cacoPoints(shape, o.x, o.y, o.w, o.rot, o.s ?? 1, o.flip);
    ctx.save();
    ctx.globalAlpha = o.alpha ?? 1;
    roundedPoly(ctx, pts, RADIUS);
    ctx.clip();
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const bx = Math.min(...xs), by = Math.min(...ys);
    const bw = Math.max(...xs) - bx, bh = Math.max(...ys) - by;
    const cover = Math.max(bw / img.width, bh / img.height) * (o.zoom ?? 1);
    const dw = img.width * cover, dh = img.height * cover;
    const fx = o.focus?.[0] ?? 0.5, fy = o.focus?.[1] ?? 0.5;
    const dx = clamp(bx + bw / 2 - dw * fx, bx + bw - dw, bx);
    const dy = clamp(by + bh / 2 - dh * fy, by + bh - dh, by);
    ctx.drawImage(img, dx + (o.panX ?? 0), dy + (o.panY ?? 0), dw, dh);
    ctx.restore();
  }

  // Encaixa um caco ao lado da aresta de outro (foto/caco) voltada para `dir`:
  // a aresta mais longa do caco fica paralela à do alvo, com respiro `gap` entre
  // elas. Como os cacos são convexos, nunca há sobreposição.
  function dockCaco(shape, w, target, dir, gap, along = 0.5, flip = false) {
    const n = target.length;
    const tc = [target.reduce((a, p) => a + p[0], 0) / n, target.reduce((a, p) => a + p[1], 0) / n];
    let best = null;
    for (let i = 0; i < n; i++) {
      const A = target[i], B = target[(i + 1) % n];
      const len = Math.hypot(B[0] - A[0], B[1] - A[1]);
      const u = [(B[0] - A[0]) / len, (B[1] - A[1]) / len];
      let nrm = [-u[1], u[0]];
      if (((A[0] + B[0]) / 2 - tc[0]) * nrm[0] + ((A[1] + B[1]) / 2 - tc[1]) * nrm[1] < 0) nrm = [u[1], -u[0]];
      const score = nrm[0] * dir[0] + nrm[1] * dir[1];
      if (!best || score > best.score) best = { A, u, len, nrm, score };
    }
    const P = cacoPoints(shape, 0, 0, w, 0, 1, flip);
    let ce = 0, cl = 0;
    P.forEach((p, i) => {
      const q = P[(i + 1) % P.length], l = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (l > cl) { cl = l; ce = i; }
    });
    const p0 = P[ce], p1 = P[(ce + 1) % P.length];
    const mid = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
    const R = (p, a) => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)];
    let rot = Math.atan2(best.u[1], best.u[0]) - Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
    let m = R(mid, rot);
    // o corpo do caco fica do lado de fora da aresta do alvo
    if (m[0] * best.nrm[0] + m[1] * best.nrm[1] > 0) { rot += Math.PI; m = R(mid, rot); }
    const T = [best.A[0] + best.u[0] * best.len * along + best.nrm[0] * gap,
      best.A[1] + best.u[1] * best.len * along + best.nrm[1] * gap];
    return { x: T[0] - m[0], y: T[1] - m[1], rot: (rot * 180) / Math.PI, nrm: best.nrm };
  }

  // Caco encaixado entrando de fora para dentro, ao longo da normal da aresta.
  function fillDocked(ctx, shape, d, w, k, alpha) {
    fillCaco(ctx, shape, {
      x: d.x + d.nrm[0] * (1 - k) * 90, y: d.y + d.nrm[1] * (1 - k) * 90,
      w, rot: d.rot, color: C.yellow, alpha: k * alpha,
    });
  }

  // ---------- tipografia ----------
  const LIGHT = 300, BOLD = 700; // Light para o texto corrido, Bold para o destaque
  function font(weight, size) {
    return `${weight} ${size}px "${FONT}"`;
  }

  // Artigos/preposições curtas nunca terminam linha: descem junto com a palavra seguinte.
  const GLUE = new Set(['a', 'à', 'ao', 'aos', 'as', 'o', 'os', 'e', 'é', 'de', 'da', 'do', 'das', 'dos',
    'em', 'na', 'no', 'nas', 'nos', 'com', 'para', 'por', 'um', 'uma']);

  // Quebra texto rico ([{text, color, weight}]) em linhas. Além de colar artigos à
  // palavra seguinte, equilibra as linhas (menor largura com o mesmo nº de linhas)
  // para não deixar viúvas.
  function layoutRich(ctx, runs, size, maxW) {
    const words = [];
    runs.forEach(r => r.text.split(' ').filter(Boolean).forEach(w => {
      ctx.font = font(r.weight, size);
      words.push({ w, color: r.color, weight: r.weight, width: ctx.measureText(w).width });
    }));
    ctx.font = font(LIGHT, size);
    const space = ctx.measureText(' ').width;
    const groups = [];
    for (let i = 0; i < words.length; i++) {
      const g = [words[i]];
      while (GLUE.has(g[g.length - 1].w.toLowerCase()) && i + 1 < words.length) g.push(words[++i]);
      groups.push(g);
    }
    const wrap = maxWidth => {
      const lines = [];
      let line = [], lw = 0;
      for (const g of groups) {
        const gw = g.reduce((a, w) => a + w.width, 0) + space * (g.length - 1);
        if (line.length && lw + space + gw > maxWidth) { lines.push(line); line = []; lw = 0; }
        let x = line.length ? lw + space : 0;
        g.forEach(w => { line.push({ ...w, x }); x += w.width + space; });
        lw = x - space;
      }
      if (line.length) lines.push(line);
      return lines;
    };
    const n = wrap(maxW).length;
    let lo = maxW * 0.4, hi = maxW;
    for (let k = 0; k < 24; k++) {
      const mid = (lo + hi) / 2;
      if (wrap(mid).length <= n) hi = mid; else lo = mid;
    }
    return wrap(hi);
  }

  // Revela as linhas uma a uma, subindo de dentro de uma máscara.
  function drawRichReveal(ctx, lines, o, t) {
    const lh = o.size * (o.lineHeight ?? 1.16);
    ctx.textBaseline = 'alphabetic';
    lines.forEach((line, i) => {
      const k = prog(t, o.start + i * o.stagger, o.start + i * o.stagger + o.dur, easeOutQuint);
      const out = o.end != null ? prog(t, o.end + i * 0.06, o.end + 0.5 + i * 0.06, easeInOut) : 0;
      if (k <= 0 || out >= 1) return;
      const baseY = o.y + i * lh;
      ctx.save();
      ctx.beginPath();
      ctx.rect(o.x - 20, baseY - o.size * 1.0, o.maxW + 40, o.size * 1.3);
      ctx.clip();
      ctx.globalAlpha = k * (1 - out);
      const dy = (1 - k) * lh * 0.9 - out * 30;
      line.forEach(word => {
        ctx.font = font(word.weight, o.size);
        ctx.fillStyle = word.color;
        ctx.fillText(word.w, o.x + word.x, baseY + dy);
      });
      ctx.restore();
    });
  }

  // Linhas definidas por frase ([[runs], [runs], ...]); o corpo diminui só se a
  // linha mais longa não couber em maxW.
  function layoutManual(ctx, lineRuns, maxW, maxSize) {
    const measure = size => lineRuns.map(runs => {
      ctx.font = font(LIGHT, size);
      const space = ctx.measureText(' ').width;
      const line = [];
      let x = 0;
      runs.forEach(r => r.text.split(' ').filter(Boolean).forEach(w => {
        ctx.font = font(r.weight, size);
        const width = ctx.measureText(w).width;
        line.push({ w, color: r.color, weight: r.weight, x, width });
        x += width + space;
      }));
      line.width = x - space;
      return line;
    });
    let size = maxSize, lines = measure(size);
    const widest = Math.max(...lines.map(l => l.width));
    if (widest > maxW) { size = Math.floor((maxSize * maxW) / widest); lines = measure(size); }
    return { lines, size };
  }

  // primeira linha de base para centralizar verticalmente um bloco de texto
  const blockTop = (lines, size, lh, cy) => cy - (lines.length * size * lh) / 2 + size * 0.86;

  function drawText(ctx, text, x, y, { size, weight = BOLD, color, align = 'left', alpha = 1, spacing = 0 }) {
    ctx.font = font(weight, size);
    ctx.letterSpacing = spacing + 'px';
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
    ctx.letterSpacing = '0px';
  }

  const fmt = n => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  // ---------- imagens ----------
  // Recorta a área útil (alpha > 0) de uma imagem/logo.
  function trim(img) {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth || img.width; c.height = img.naturalHeight || img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0, c.width, c.height);
    const { data } = g.getImageData(0, 0, c.width, c.height);
    let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
      if (data[(y * c.width + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
    const out = document.createElement('canvas');
    out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
    out.getContext('2d').drawImage(c, -x0, -y0);
    return out;
  }

  function drawLogo(ctx, img, x, y, w, alpha = 1) {
    if (alpha <= 0) return;
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, x, y, w, (w * img.height) / img.width);
    ctx.globalAlpha = 1;
  }

  function loadImage(src) {
    return new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => rej(new Error('Falha ao carregar imagem'));
      im.src = src;
    });
  }

  // ---------- estado ----------
  const A = {}; // assets carregados
  let S;        // cacos normalizados por nome ("Ativo 11" -> 11)

  async function init(assets) {
    const faces = [['Light', LIGHT], ['Bold', BOLD]].map(([n, w]) =>
      new FontFace(FONT, `url(${assets.fonts[n]})`, { weight: String(w) }));
    await Promise.all(faces.map(f => f.load().then(ff => document.fonts.add(ff))));

    const [p1, p2, lg, lgNeg] = await Promise.all([
      loadImage(assets.images.foto1), loadImage(assets.images.foto2),
      loadImage(assets.images.logoCampanha), loadImage(assets.images.logoCampanhaNeg),
    ]);
    A.foto1 = p1; A.foto2 = p2;
    A.logo = trim(lg); A.logoNeg = trim(lgNeg);

    S = {};
    for (const [name, s] of Object.entries(assets.shapes)) S[name] = polygonFromPath(s.d, s.w, s.h);
  }

  // ---------- roteiro ----------
  const LOGO_W = 755; // logo da campanha na abertura/fechamento
  const WIPE1 = [11.45, 12.15], WIPE2 = [37.35, 38.15];
  const CLOSE_T0 = 47.4; // tela de fechamento com o logo
  const ITEMS = [
    { pre: '+ de R$', num: 11, suf: 'milhões', label: 'em reconhecimentos', color: C.yellow },
    { num: 1413, label: 'Agilizados reconhecidos', color: C.lime },
    { num: 1360, label: 'méritos e bônus', color: C.yellow },
    { num: 80, label: 'promoções', color: C.lime },
  ];
  const ITEM_T0 = 15.0, ITEM_DUR = 4.0; // cada tópico ganha 4s de leitura
  const SUMMARY_T0 = ITEM_T0 + ITEM_DUR * 4; // 31s

  // Cacos da tela azul: poucos, maiores e nas extremidades (alguns vazados para fora),
  // mais alguns pequenos, como nos exemplos de aplicação da marca.
  const CELEB = [
    { s: 25, x: 150, y: 1035, w: 470, rot: 8, from: [-1, 1] },
    { s: 22, x: 1830, y: 990, w: 380, rot: -10, from: [1, 1] },
    { s: 8, x: 1965, y: 560, w: 230, rot: 0, from: [1, 0] },
    { s: 10, x: -50, y: 560, w: 160, rot: 62, from: [-1, 0] },
    { s: 36, x: 1490, y: 255, w: 80, rot: 18, from: [0, -1] },
    { s: 13, x: 610, y: 945, w: 100, rot: -14, from: [0, 1] },
    { s: 5, x: 330, y: 270, w: 84, rot: 12, from: [0, -1] },
    { s: 3, x: 1300, y: 960, w: 92, rot: -22, from: [0, 1] },
  ];

  function scene1(ctx, t) {
    // cacos amarelos de composição (respiram sutilmente)
    const b = Math.sin(t * 0.6);
    const yIn = k => prog(t, k, k + 1.4, easeOutQuint);
    const out = prog(t, 10.9, 11.5, easeInOut);
    const ys = [
      { s: S[25], x: 130, y: 1010, w: 520, rot: 6 - b, d: 0.3, from: [-160, 120] },
    ];
    ys.forEach(c => {
      const k = yIn(c.d);
      if (k <= 0) return;
      fillCaco(ctx, c.s, {
        x: c.x + c.from[0] * (1 - k) + Math.cos(t * 0.5 + c.d) * 6,
        y: c.y + c.from[1] * (1 - k) + b * 6,
        w: c.w, rot: c.rot, s: lerp(0.8, 1, k), color: C.yellow, alpha: k * (1 - out),
      });
    });

    // logo "O jeito Agi | Crescer na jornada": entra no centro e assenta no topo
    const lIn = prog(t, 0.4, 2.0, easeOutQuint);
    const move = prog(t, 3.5, 4.8, easeInOut);
    const wSmall = 320;
    const lw = lerp(LOGO_W, wSmall, move);
    const lh = (lw * A.logo.height) / A.logo.width;
    const lx = lerp((W - LOGO_W) / 2, MARGIN, move);
    const ly = lerp((H - (LOGO_W * A.logo.height) / A.logo.width) / 2, 92, move) + (1 - lIn) * 40;
    const lScale = lerp(0.94, 1, lIn);
    ctx.save();
    ctx.translate(lx + lw / 2, ly + lh / 2);
    ctx.scale(lScale, lScale);
    drawLogo(ctx, A.logo, -lw / 2, -lh / 2, lw, lIn * (1 - out));
    ctx.restore();

    // foto 1 mascarada em caco (Ativo 37) + cacos amarelos encaixados nas arestas
    const PH = { x: 1490, y: 540, w: 680, rot: -1.5 };
    const photo = cacoPoints(S[37], PH.x, PH.y, PH.w, PH.rot);
    const dTop = dockCaco(S[32], 380, photo, [0.2, -1], 24, 0.62);
    const dBot = dockCaco(S[15], 250, photo, [0, 1], 24, 0.3);
    fillDocked(ctx, S[32], dTop, 380, prog(t, 0.1, 1.5, easeOutQuint), 1 - out);
    fillDocked(ctx, S[15], dBot, 250, prog(t, 5.3, 6.6, easeOutQuint), 1 - out);
    const pIn = prog(t, 4.3, 5.9, easeOutQuint);
    if (pIn > 0) {
      photoCaco(ctx, A.foto1, S[37], {
        x: PH.x, y: PH.y, w: PH.w, rot: lerp(-4, PH.rot, pIn), s: lerp(0.86, 1, pIn),
        zoom: lerp(1.22, 1.06, pIn) - (t - 6) * 0.004, focus: [0.5, 0.36],
        alpha: pIn * (1 - out),
      });
    }

    // lettering (fundo claro: azul Agibank, Light + Bold no destaque)
    const L = text => ({ text, color: C.blue, weight: LIGHT });
    const B = text => ({ text, color: C.blue, weight: BOLD });
    const lhK = 1.18;
    const { lines, size } = layoutManual(ctx, [
      [L('Quem contribui')],
      [L('com o crescimento do Agi')],
      [L('vive a'), B('meritocracia na prática')],
      [L('e é'), B('reconhecido'), L('por isso.')],
    ], 960, 66);
    drawRichReveal(ctx, lines, {
      x: MARGIN, y: blockTop(lines, size, lhK, 580), size, maxW: 960, lineHeight: lhK,
      start: 5.3, stagger: 0.32, dur: 1.1, end: 10.6,
    }, t);
  }

  // Transição: um caco cresce a partir de um ponto até cobrir a tela.
  function cacoWipe(ctx, t, [a, b], color, cx, cy, shape, rot0) {
    const k = prog(t, a, b, easeInOut);
    if (k <= 0) return false;
    if (k >= 1) { ctx.fillStyle = color; ctx.fillRect(0, 0, W, H); return true; }
    fillCaco(ctx, shape, { x: cx, y: cy, w: lerp(40, 5200, k), rot: rot0 + k * 30, color, r: RADIUS });
    return false;
  }

  function scene3(ctx, t) {
    const out = prog(t, 36.8, 37.4, easeInOut);
    CELEB.forEach((c, i) => {
      const k = prog(t, 12.2 + i * 0.12, 13.4 + i * 0.12, easeOutQuint);
      if (k <= 0) return;
      // pulinho sutil quando cada tópico aparece
      let hop = 0;
      for (let j = 0; j < 4; j++) {
        const hk = clamp((t - (ITEM_T0 + j * ITEM_DUR + 0.2 + i * 0.05)) / 0.8);
        if (hk > 0 && hk < 1) hop = Math.sin(hk * Math.PI) * 14;
      }
      const f = Math.sin(t * 0.55 + i * 1.7);
      fillCaco(ctx, S[c.s], {
        x: c.x + c.from[0] * (1 - k) * 260 + Math.cos(t * 0.4 + i) * 8,
        y: c.y + c.from[1] * (1 - k) * 260 + f * 10 - hop,
        w: c.w, rot: c.rot + f * 3, s: lerp(0.85, 1, k), r: Math.min(RADIUS, c.w * 0.12),
        color: C.yellow, alpha: k * (1 - out),
      });
    });

    // abertura: lockup centralizado → assenta como header (logo branco + título)
    const hIn = prog(t, 12.1, 13.2, easeOutQuint);
    const dock = prog(t, 14.0, 14.9, easeInOut);
    const hOut = 1 - out;
    const lwBig = 760, lwSmall = 330;
    const lw = lerp(lwBig, lwSmall, dock);
    const lhBig = (lwBig * A.logoNeg.height) / A.logoNeg.width;
    const lx = lerp((W - lwBig) / 2, MARGIN, dock);
    const ly = lerp(300, 78, dock) + (1 - hIn) * 40;
    drawLogo(ctx, A.logoNeg, lx, ly, lw, hIn * hOut);

    const tIn = prog(t, 12.4, 13.5, easeOutQuint);
    const size = lerp(104, 46, dock);
    const tx = lerp(W / 2, W - MARGIN, dock);
    const ty = lerp(300 + lhBig + 175, 78 + (lwSmall * A.logoNeg.height) / A.logoNeg.width / 2 + 16, dock) + (1 - tIn) * 40;
    ctx.font = font(LIGHT, size);
    const wa = ctx.measureText('Reconhecimentos ').width;
    ctx.font = font(BOLD, size);
    const wb = ctx.measureText('2026.2').width;
    const startX = lerp(tx - (wa + wb) / 2, tx - wa - wb, dock);
    drawText(ctx, 'Reconhecimentos', startX, ty, { size, weight: LIGHT, color: C.white, alpha: tIn * hOut });
    drawText(ctx, '2026.2', startX + wa, ty, { size, weight: BOLD, color: C.white, alpha: tIn * hOut });

    // tópicos em destaque, um a um
    ITEMS.forEach((it, i) => drawHero(ctx, t, it, i));
    drawSummary(ctx, t);
  }

  function drawHero(ctx, t, it, i) {
    const a = ITEM_T0 + i * ITEM_DUR, b = a + ITEM_DUR;
    const k = prog(t, a, a + 0.8, easeOutQuint);
    const o = prog(t, b - 0.5, b, easeInOut);
    if (k <= 0 || o >= 1) return;
    const alpha = k * (1 - o);
    const rise = (1 - k) * 60 - o * 50;
    const value = it.num * prog(t, a + 0.1, a + 1.5, easeOutQuint);
    const numStr = fmt(value);
    const NUM = 300, PRE = 64, SUF = 140, LABEL = 72;
    const baseY = 640 + rise;

    // mede a composição para centralizar pelo valor final (sem "pular")
    ctx.font = font(BOLD, NUM); const wn = ctx.measureText(fmt(it.num)).width;
    ctx.font = font(LIGHT, PRE); const wp = it.pre ? ctx.measureText(it.pre).width + 26 : 0;
    ctx.font = font(BOLD, SUF); const ws = it.suf ? ctx.measureText(it.suf).width + 30 : 0;
    const x0 = (W - (wp + wn + ws)) / 2;

    // índice do tópico
    drawText(ctx, `0${i + 1}`, W / 2, 330 + rise * 0.5, { size: 34, weight: BOLD, color: it.color, align: 'center', alpha, spacing: 4 });
    ctx.globalAlpha = alpha;
    ctx.fillStyle = it.color;
    roundRect(ctx, W / 2 - 28, 350 + rise * 0.5, 56, 5, 2.5); ctx.fill();
    ctx.globalAlpha = 1;

    if (it.pre) drawText(ctx, it.pre, x0, baseY - NUM * 0.47, { size: PRE, weight: LIGHT, color: C.white, alpha });
    drawText(ctx, numStr, x0 + wp + wn, baseY, { size: NUM, weight: BOLD, color: it.color, align: 'right', alpha, spacing: -6 });
    if (it.suf) drawText(ctx, it.suf, x0 + wp + wn + 30, baseY, { size: SUF, weight: BOLD, color: it.color, alpha });

    const lk = prog(t, a + 0.45, a + 1.25, easeOutQuint) * (1 - o);
    drawText(ctx, it.label, W / 2, baseY + 130 + (1 - lk) * 30, { size: LABEL, weight: LIGHT, color: C.white, align: 'center', alpha: lk });
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }

  // fechamento da cena: os 4 números juntos em módulos arredondados
  function drawSummary(ctx, t) {
    const a = SUMMARY_T0;
    const o = prog(t, 36.7, 37.3, easeInOut);
    if (t < a || o >= 1) return;
    const m = 100, gap = 28, cw = (W - m * 2 - gap * 3) / 4, ch = 430, cy = 360;
    ITEMS.forEach((it, i) => {
      const k = prog(t, a + i * 0.18, a + i * 0.18 + 0.9, easeOutQuint);
      if (k <= 0) return;
      const alpha = k * (1 - o);
      const cx = m + i * (cw + gap);
      const dy = (1 - k) * 70;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = C.mid;
      roundRect(ctx, cx, cy + dy, cw, ch, RADIUS); ctx.fill();
      ctx.globalAlpha = 1;
      const mx = cx + cw / 2; // tudo centralizado no módulo
      let y = cy + dy + 92;
      if (it.pre) drawText(ctx, it.pre, mx, y, { size: 38, weight: LIGHT, color: C.white, align: 'center', alpha });
      y += 128;
      ctx.font = font(BOLD, 118); ctx.letterSpacing = '-3px';
      const nw = ctx.measureText(fmt(it.num)).width; ctx.letterSpacing = '0px';
      ctx.font = font(BOLD, 44);
      const sw = it.suf ? ctx.measureText(it.suf).width + 12 : 0;
      const nx = mx - (nw + sw) / 2;
      drawText(ctx, fmt(it.num), nx, y, { size: 118, weight: BOLD, color: it.color, alpha, spacing: -3 });
      if (it.suf) drawText(ctx, it.suf, nx + nw + 12, y, { size: 44, weight: BOLD, color: it.color, alpha });
      y += 72;
      const lines = layoutRich(ctx, [{ text: it.label, color: C.white, weight: LIGHT }], 36, cw - 60);
      lines.forEach((ln, j) => {
        const last = ln[ln.length - 1], lw = last.x + last.width;
        ln.forEach(w => drawText(ctx, w.w, mx - lw / 2 + w.x, y + j * 44, { size: 36, weight: LIGHT, color: C.white, alpha }));
      });
    });
  }

  function scene4(ctx, t) {
    const b = Math.sin(t * 0.6);
    const end = prog(t, DURATION - 0.6, DURATION, easeInOut); // fade final p/ loop limpo no telão
    const leave = prog(t, CLOSE_T0 - 0.6, CLOSE_T0 + 0.2, easeInOut); // foto/texto saem para o fechamento
    const k1 = prog(t, 38.4, 39.8, easeOutQuint);
    const k2 = prog(t, 38.7, 40.1, easeOutQuint);
    if (k1 > 0) {
      fillCaco(ctx, S[1], { x: 1760 + (1 - k1) * 160, y: 80, w: 460, rot: 8 + b, color: C.yellow, alpha: k1 * (1 - end) });
    }
    // foto 2 recortada em caco (Ativo 32) + caco encaixado na aresta inferior
    const PH = { x: 470, y: 530, w: 720, rot: 2 };
    const photo = cacoPoints(S[32], PH.x, PH.y, PH.w, PH.rot, 1, true);
    const dBot = dockCaco(S[29], 300, photo, [-0.2, 1], 24, 0.25);
    fillDocked(ctx, S[29], dBot, 300, prog(t, 39.6, 40.9, easeOutQuint), (1 - leave) * (1 - end));
    if (k2 > 0 && leave < 1) {
      photoCaco(ctx, A.foto2, S[32], {
        x: PH.x - leave * 80, y: PH.y, w: PH.w, rot: lerp(5, PH.rot, k2), s: lerp(0.86, 1, k2) - leave * 0.06, flip: true,
        zoom: lerp(1.25, 1.08, k2) - (t - 40) * 0.004, focus: [0.48, 0.5],
        alpha: k2 * (1 - leave),
      });
    }

    const L = text => ({ text, color: C.blue, weight: LIGHT });
    const B = text => ({ text, color: C.blue, weight: BOLD });
    const lhK = 1.18;
    const { lines, size } = layoutManual(ctx, [
      [L('Acesse o'), B('Portal Sempre Juntos')],
      [L('e conheça os'), B('Agilizados')],
      [L('que foram reconhecidos!')],
    ], 900, 72);
    drawRichReveal(ctx, lines, {
      x: 920, y: blockTop(lines, size, lhK, 540), size, maxW: 900, lineHeight: lhK,
      start: 39.6, stagger: 0.3, dur: 1.1, end: CLOSE_T0 - 0.7,
    }, t);

    // tela de fechamento: logo "O jeito Agi | Crescer na jornada"
    const c = prog(t, CLOSE_T0, CLOSE_T0 + 1.2, easeOutQuint);
    if (c > 0) {
      fillCaco(ctx, S[22], { x: 1800 + (1 - c) * 160, y: 985 + (1 - c) * 100, w: 330, rot: -8 - b, color: C.yellow, alpha: c * (1 - end) });
      fillCaco(ctx, S[36], { x: 250, y: 170 - (1 - c) * 120, w: 110, rot: 24 + b * 3, color: C.yellow, alpha: c * (1 - end) });
      const lh = (LOGO_W * A.logo.height) / A.logo.width;
      const s = lerp(0.94, 1, c);
      ctx.save();
      ctx.translate(W / 2, H / 2 + (1 - c) * 40);
      ctx.scale(s, s);
      drawLogo(ctx, A.logo, -LOGO_W / 2, -lh / 2, LOGO_W, c * (1 - end));
      ctx.restore();
    }
  }

  function render(ctx, t) {
    ctx.save();
    ctx.fillStyle = C.gray;
    ctx.fillRect(0, 0, W, H);
    if (t < WIPE1[1]) scene1(ctx, t);
    const blueFull = cacoWipe(ctx, t, WIPE1, C.blue, 1490, 540, S[33], -20);
    if (blueFull) {
      if (t < WIPE2[1]) {
        scene3(ctx, t);
      }
      const grayFull = cacoWipe(ctx, t, WIPE2, C.gray, 560, 540, S[12], 15);
      if (grayFull) scene4(ctx, t);
    }
    ctx.restore();
  }

  window.TELAO = { W, H, FPS, DURATION, init, render };
})();
