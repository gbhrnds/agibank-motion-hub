/*
 * Vídeo Telão Campus — motor de animação (Canvas 2D, determinístico).
 * Cada frame é uma função pura de t (segundos), o que permite tocar no
 * navegador, exportar via MediaRecorder e renderizar quadro a quadro em MP4.
 */
(function () {
  const W = 1920, H = 1080, FPS = 24, DURATION = 50;
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
    ctx.fillStyle = o.color;
    ctx.fill();
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

  // ---------- tipografia ----------
  function font(weight, size) {
    return `${weight} ${size}px "${FONT}"`;
  }

  // Quebra texto rico ([{text, color}]) em linhas de largura máxima.
  function layoutRich(ctx, runs, size, weight, maxW) {
    ctx.font = font(weight, size);
    const words = [];
    runs.forEach(r => r.text.split(' ').filter(Boolean).forEach(w => words.push({ w, color: r.color })));
    const space = ctx.measureText(' ').width;
    const lines = [];
    let line = [], lw = 0;
    for (const word of words) {
      const ww = ctx.measureText(word.w).width;
      if (line.length && lw + space + ww > maxW) { lines.push(line); line = []; lw = 0; }
      word.x = line.length ? lw + space : 0;
      lw = word.x + ww;
      line.push(word);
    }
    if (line.length) lines.push(line);
    return lines;
  }

  // Revela as linhas uma a uma, subindo de dentro de uma máscara.
  function drawRichReveal(ctx, lines, o, t) {
    const lh = o.size * (o.lineHeight ?? 1.16);
    ctx.font = font(o.weight, o.size);
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
        ctx.fillStyle = word.color;
        ctx.fillText(word.w, o.x + word.x, baseY + dy);
      });
      ctx.restore();
    });
  }

  function drawText(ctx, text, x, y, { size, weight = 700, color, align = 'left', alpha = 1, spacing = 0 }) {
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
  let confetti; // partículas da cena de números

  async function init(assets) {
    const faces = [['Regular', 400], ['Medium', 500], ['Bold', 700]].map(([n, w]) =>
      new FontFace(FONT, `url(${assets.fonts[n]})`, { weight: String(w) }));
    await Promise.all(faces.map(f => f.load().then(ff => document.fonts.add(ff))));

    const [p1, p2, lg, lgNeg, agibank] = await Promise.all([
      loadImage(assets.images.foto1), loadImage(assets.images.foto2),
      loadImage(assets.images.logoCampanha), loadImage(assets.images.logoCampanhaNeg),
      loadImage(assets.images.agibank),
    ]);
    A.foto1 = p1; A.foto2 = p2;
    A.logo = trim(lg); A.logoNeg = trim(lgNeg);
    // rasteriza o SVG do Agibank em alta para recortar sem perda
    const big = document.createElement('canvas');
    big.width = 1920 * 2; big.height = Math.round(1082.79 * 2);
    big.getContext('2d').drawImage(agibank, 0, 0, big.width, big.height);
    A.agibank = trim(big);

    S = {};
    for (const [name, s] of Object.entries(assets.shapes)) S[name] = polygonFromPath(s.d, s.w, s.h);
    buildConfetti();
  }

  // ---------- CENA 03: confetes de cacos ----------
  const CONF_SHAPES = [3, 5, 6, 8, 10, 11, 13, 15, 20, 22, 23, 24, 26, 31, 35, 36];
  function buildConfetti() {
    const r = rng(2026);
    confetti = [];
    // zonas de respiro ao redor do conteúdo (nunca sobre os números/textos)
    const zones = [
      [40, 190, 240, 1040], [1680, 190, 1880, 1040],  // laterais
      [240, 905, 1680, 1050],                         // faixa inferior
      [260, 175, 1660, 255],                          // faixa superior (abaixo do header)
    ];
    const weights = [0.3, 0.3, 0.25, 0.15];
    for (let k = 0; k < 34; k++) {
      let zi = 0, acc = r();
      while (acc > weights[zi] && zi < 3) { acc -= weights[zi]; zi++; }
      const z = zones[zi];
      confetti.push({
        shape: CONF_SHAPES[Math.floor(r() * CONF_SHAPES.length)],
        x: lerp(z[0], z[2], r()), y: lerp(z[1], z[3], r()),
        w: lerp(26, zi < 2 ? 70 : 52, r()),
        rot: r() * 360, spin: lerp(-14, 14, r()),
        amp: lerp(6, 16, r()), freq: lerp(0.35, 0.7, r()), phase: r() * Math.PI * 2,
        color: r() < 0.55 ? C.yellow : C.white,
        delay: 12.5 + r() * 2.2,
        hop: Math.floor(r() * 4), // pulinho em um dos tópicos
      });
    }
  }

  // ---------- roteiro ----------
  const T1 = { start: 0, end: 12 }, T3 = { start: 12, end: 38 }, T4 = { start: 38, end: 50 };
  const ITEMS = [
    { pre: '+ de R$', num: 11, suf: 'milhões', label: 'em reconhecimentos', color: C.yellow },
    { num: 1413, label: 'Agilizados reconhecidos', color: C.lime },
    { num: 1360, label: 'méritos e bônus', color: C.yellow },
    { num: 80, label: 'promoções', color: C.lime },
  ];
  const ITEM_T0 = 15.8, ITEM_DUR = 3.9; // cada tópico ganha ~4s de leitura
  const SUMMARY_T0 = ITEM_T0 + ITEM_DUR * 4; // 31.4s

  function scene1(ctx, t) {
    // cacos amarelos de composição (respiram sutilmente)
    const b = Math.sin(t * 0.6);
    const yIn = k => prog(t, k, k + 1.4, easeOutQuint);
    const out = prog(t, 11.0, 11.8, easeInOut);
    const ys = [
      { s: S[32], x: 1830, y: 70, w: 420, rot: -8 + b * 1.2, d: 0.1, from: [140, -120] },
      { s: S[25], x: 130, y: 1010, w: 520, rot: 6 - b, d: 0.3, from: [-160, 120] },
      { s: S[24], x: 1010, y: 960, w: 120, rot: 30 + b * 3, d: 4.9, from: [0, 60] },
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
    const wBig = 1180, wSmall = 400;
    const lw = lerp(wBig, wSmall, move);
    const lh = (lw * A.logo.height) / A.logo.width;
    const lx = lerp((W - wBig) / 2, MARGIN, move);
    const ly = lerp((H - (wBig * A.logo.height) / A.logo.width) / 2, 92, move) + (1 - lIn) * 40;
    const lScale = lerp(0.94, 1, lIn);
    ctx.save();
    ctx.translate(lx + lw / 2, ly + lh / 2);
    ctx.scale(lScale, lScale);
    drawLogo(ctx, A.logo, -lw / 2, -lh / 2, lw, lIn * (1 - prog(t, 10.9, 11.5, easeInOut)));
    ctx.restore();

    // foto 1 mascarada em caco (Ativo 37) + caco amarelo de apoio
    const pIn = prog(t, 4.3, 5.9, easeOutQuint);
    if (pIn > 0) {
      fillCaco(ctx, S[15], {
        x: 1180 - (1 - pIn) * 60, y: 860 + (1 - pIn) * 60, w: 300, rot: -12 + b * 1.5,
        color: C.yellow, alpha: pIn * (1 - out),
      });
      photoCaco(ctx, A.foto1, S[37], {
        x: 1395, y: 520, w: 880, rot: lerp(-4, -1.5, pIn), s: lerp(0.86, 1, pIn),
        zoom: lerp(1.22, 1.06, pIn) - (t - 6) * 0.004, focus: [0.5, 0.36],
        alpha: pIn * (1 - prog(t, 11.1, 11.7, easeInOut)),
      });
    }

    // lettering
    const runs = [
      { text: 'Quem contribui com o crescimento do Agi vive a', color: C.navy },
      { text: 'meritocracia na prática', color: C.blue },
      { text: 'e é', color: C.navy },
      { text: 'reconhecido', color: C.blue },
      { text: 'por isso.', color: C.navy },
    ];
    const lines = layoutRich(ctx, runs, 70, 700, 760);
    drawRichReveal(ctx, lines, {
      x: MARGIN, y: 370, size: 70, weight: 700, maxW: 760, lineHeight: 1.16,
      start: 5.3, stagger: 0.32, dur: 1.1, end: 10.7,
    }, t);
  }

  // Transição: um caco cresce a partir de um ponto até cobrir a tela.
  function cacoWipe(ctx, t, a, b, color, cx, cy, shape, rot0) {
    const k = prog(t, a, b, easeInOut);
    if (k <= 0) return false;
    if (k >= 1) { ctx.fillStyle = color; ctx.fillRect(0, 0, W, H); return true; }
    fillCaco(ctx, shape, { x: cx, y: cy, w: lerp(40, 5200, k), rot: rot0 + k * 35, color, r: RADIUS });
    return false;
  }

  function scene3(ctx, t) {
    // confetes de celebração flutuando nas margens
    const out = prog(t, 36.9, 37.5, easeInOut);
    const sum = prog(t, SUMMARY_T0 - 0.4, SUMMARY_T0 + 0.4, easeInOut);
    confetti.forEach(p => {
      // abre espaço para os módulos do resumo
      const inCards = p.x > MARGIN - 40 && p.x < W - MARGIN + 40 && p.y > 320 && p.y < 830;
      const k = prog(t, p.delay, p.delay + 0.9, easeOutQuint);
      if (k <= 0) return;
      // pulinho quando o tópico correspondente aparece
      const ht = ITEM_T0 + p.hop * ITEM_DUR + 0.25;
      const hk = clamp((t - ht) / 0.9);
      const hop = hk > 0 && hk < 1 ? Math.sin(hk * Math.PI) * 26 : 0;
      fillCaco(ctx, S[p.shape], {
        x: p.x + Math.sin(t * p.freq * 0.7 + p.phase) * p.amp * 0.6,
        y: p.y + Math.sin(t * p.freq + p.phase) * p.amp - hop - (1 - k) * 40,
        w: p.w, rot: p.rot + t * p.spin, s: lerp(0.3, 1, k), r: p.w * 0.12,
        color: p.color, alpha: k * (1 - out) * (inCards ? 1 - sum : 1) * (p.color === C.white ? 0.92 : 1),
      });
    });

    // abertura: lockup grande centralizado → assenta como header
    const hIn = prog(t, 12.7, 14.1, easeOutQuint);
    const dock = prog(t, 14.7, 15.7, easeInOut);
    const hOut = 1 - prog(t, 36.8, 37.4, easeInOut);
    const lwBig = 760, lwSmall = 330;
    const lw = lerp(lwBig, lwSmall, dock);
    const lhBig = (lwBig * A.logoNeg.height) / A.logoNeg.width;
    const lx = lerp((W - lwBig) / 2, MARGIN, dock);
    const ly = lerp(300, 78, dock) + (1 - hIn) * 40;
    drawLogo(ctx, A.logoNeg, lx, ly, lw, hIn * hOut);

    const tIn = prog(t, 13.1, 14.5, easeOutQuint);
    const size = lerp(104, 46, dock);
    const tx = lerp(W / 2, W - MARGIN, dock);
    const ty = lerp(300 + lhBig + 175, 78 + (lwSmall * A.logoNeg.height) / A.logoNeg.width / 2 + 16, dock) + (1 - tIn) * 40;
    ctx.font = font(700, size);
    const wa = ctx.measureText('Reconhecimentos ').width, wb = ctx.measureText('2026.2').width;
    const startX = lerp(tx - (wa + wb) / 2, tx - wa - wb, dock);
    drawText(ctx, 'Reconhecimentos', startX, ty, { size, weight: 500, color: C.white, alpha: tIn * hOut });
    drawText(ctx, '2026.2', startX + wa, ty, { size, weight: 700, color: C.white, alpha: tIn * hOut });

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
    ctx.font = font(700, NUM); const wn = ctx.measureText(fmt(it.num)).width;
    ctx.font = font(500, PRE); const wp = it.pre ? ctx.measureText(it.pre).width + 26 : 0;
    ctx.font = font(700, SUF); const ws = it.suf ? ctx.measureText(it.suf).width + 30 : 0;
    const x0 = (W - (wp + wn + ws)) / 2;

    // índice do tópico
    drawText(ctx, `0${i + 1}`, W / 2, 330 + rise * 0.5, { size: 34, weight: 700, color: it.color, align: 'center', alpha, spacing: 4 });
    ctx.globalAlpha = alpha;
    ctx.fillStyle = it.color;
    roundRect(ctx, W / 2 - 28, 350 + rise * 0.5, 56, 5, 2.5); ctx.fill();
    ctx.globalAlpha = 1;

    if (it.pre) drawText(ctx, it.pre, x0, baseY - NUM * 0.47, { size: PRE, weight: 500, color: C.white, alpha });
    drawText(ctx, numStr, x0 + wp + wn, baseY, { size: NUM, weight: 700, color: it.color, align: 'right', alpha, spacing: -6 });
    if (it.suf) drawText(ctx, it.suf, x0 + wp + wn + 30, baseY, { size: SUF, weight: 700, color: it.color, alpha });

    const lk = prog(t, a + 0.45, a + 1.25, easeOutQuint) * (1 - o);
    drawText(ctx, it.label, W / 2, baseY + 130 + (1 - lk) * 30, { size: LABEL, weight: 500, color: C.white, align: 'center', alpha: lk });
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
    const gap = 36, cw = (W - MARGIN * 2 - gap * 3) / 4, ch = 430, cy = 360;
    ITEMS.forEach((it, i) => {
      const k = prog(t, a + i * 0.18, a + i * 0.18 + 0.9, easeOutQuint);
      if (k <= 0) return;
      const alpha = k * (1 - o);
      const cx = MARGIN + i * (cw + gap);
      const dy = (1 - k) * 70;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = C.mid;
      roundRect(ctx, cx, cy + dy, cw, ch, RADIUS); ctx.fill();
      ctx.globalAlpha = 1;
      const px = cx + 44;
      let y = cy + dy + 92;
      drawText(ctx, it.pre || ' ', px, y, { size: 38, weight: 500, color: C.white, alpha });
      y += 128;
      drawText(ctx, fmt(it.num), px - 4, y, { size: 118, weight: 700, color: it.color, alpha, spacing: -3 });
      y += 76;
      const label = it.suf ? `${it.suf} ${it.label}` : it.label;
      const lines = layoutRich(ctx, [{ text: label, color: C.white }], 40, 500, cw - 88);
      lines.forEach((ln, j) => ln.forEach(w =>
        drawText(ctx, w.w, px + w.x, y + j * 48, { size: 40, weight: 500, color: C.white, alpha })));
    });
  }

  function scene4(ctx, t) {
    const b = Math.sin(t * 0.6);
    const end = prog(t, 49.4, 50, easeInOut); // fade final p/ loop limpo no telão
    const k1 = prog(t, 38.6, 40.0, easeOutQuint);
    const k2 = prog(t, 38.9, 40.3, easeOutQuint);
    if (k1 > 0) {
      fillCaco(ctx, S[1], { x: 1760 + (1 - k1) * 160, y: 80, w: 460, rot: 8 + b, color: C.yellow, alpha: k1 * (1 - end) });
      fillCaco(ctx, S[29], { x: 150 - (1 - k1) * 120, y: 970 + (1 - k1) * 80, w: 340, rot: -14 - b * 1.5, color: C.yellow, alpha: k1 * (1 - end) });
    }
    // foto 2 recortada em caco (Ativo 32)
    if (k2 > 0) {
      photoCaco(ctx, A.foto2, S[32], {
        x: 560, y: 530, w: 940, rot: lerp(5, 2, k2) + b * 0.4, s: lerp(0.86, 1, k2), flip: true,
        zoom: lerp(1.25, 1.08, k2) - (t - 40) * 0.004, focus: [0.48, 0.5],
        alpha: k2 * (1 - end),
      });
    }

    const runs = [
      { text: 'Acesse o', color: C.navy },
      { text: 'Portal Sempre Juntos', color: C.blue },
      { text: 'e conheça os Agilizados reconhecidos!', color: C.navy },
    ];
    const lines = layoutRich(ctx, runs, 74, 700, 700);
    drawRichReveal(ctx, lines, {
      x: 1100, y: 390, size: 74, weight: 700, maxW: 700, lineHeight: 1.14,
      start: 39.8, stagger: 0.3, dur: 1.1, end: 49.3,
    }, t);

    // assinatura Agibank (área de respiro preservada)
    const sk = prog(t, 42.0, 43.2, easeOutQuint) * (1 - end);
    drawLogo(ctx, A.agibank, 1100, 860 + (1 - sk) * 24, 300, sk);
  }

  function render(ctx, t) {
    ctx.save();
    ctx.fillStyle = C.gray;
    ctx.fillRect(0, 0, W, H);
    if (t < 12.6) scene1(ctx, t);
    const blueFull = cacoWipe(ctx, t, 11.3, 12.6, C.blue, 1395, 520, S[33], -20);
    if (blueFull || t >= 12.6) {
      if (t < 38.6) {
        ctx.fillStyle = C.blue; ctx.fillRect(0, 0, W, H);
        scene3(ctx, t);
      }
      const grayFull = cacoWipe(ctx, t, 37.3, 38.6, C.gray, 560, 540, S[12], 15);
      if (grayFull) scene4(ctx, t);
    }
    ctx.restore();
  }

  window.TELAO = { W, H, FPS, DURATION, init, render };
})();
