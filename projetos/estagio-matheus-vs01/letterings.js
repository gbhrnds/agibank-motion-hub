// Motor de letterings VS01 — Programa de Estágio Agi (Matheus).
// Tudo é função pura do tempo do vídeo: render(t) desenha o quadro exato,
// então o player (tempo real) e o render.mjs (quadro a quadro) usam o mesmo código.
(function () {
  // Gatilhos extraídos da transcrição com timestamps por palavra (transcricao.json).
  // in = início da palavra-gatilho; marks = gatilhos internos; out = fim da animação de saída.
  const DEFAULT_CUES = [
    { id: 'gc', nome: '1 · Lower third Matheus', fala: '“Eu sou o Matheus, estagiário em governança de TI”', in: 74.72, out: 79.0 },
    { id: 'prazo', nome: '2 · Prazo de inscrição', fala: '“…correr e se inscrever no Programa de Estágio do Agi…”', in: 87.96, out: 92.85,
      marks: { hl: { nome: 'Destaque “dia 08”', t: 91.2 } } },
    { id: 'bolsa', nome: '3 · Bolsa-auxílio R$ 2.400', fala: '“…bolsa-auxílio de 2 mil e 400 reais”', in: 94.54, out: 98.2 },
    { id: 'vavr', nome: '4 · VA e VR + de R$ 1.200', fala: '“…VA e VR de mais de mil e 200 reais”', in: 96.36, out: 98.2 },
    { id: 'tags', nome: '5 · Tags de benefícios', fala: '“…flexibilidade de jornada diária, mentoria próxima… IA…”', in: 98.46, out: 104.4,
      marks: { t2: { nome: 'Tag “Mentoria próxima”', t: 100.52 }, t3: { nome: 'Tag “IA no seu dia a dia”', t: 101.82 } } },
    { id: 'req', nome: '6 · Requisito de curso', fala: '“…você precisa estar cursando Graduação a partir do 4º semestre…”', in: 105.08, out: 110.75 },
    { id: 'pres', nome: '7 · 100% Presencial', fala: '“…100% presencial em Campinas”', in: 110.94, out: 114.2 },
    { id: 'final', nome: '8 · Frase final', fala: '“…com inteligência e com a gente”', in: 119.06, out: 122.4, saida: 'fade',
      marks: {
        w2: { nome: 'Palavra “inteligência,”', t: 119.42 },
        w3: { nome: 'Palavra “com”', t: 120.3 },
        w4: { nome: 'Palavra “a”', t: 120.44 },
        w5: { nome: 'Palavra “gente!”', t: 120.56 },
      } },
  ];

  const OUT_DUR = 0.42;

  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const ease = {
    expo: (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
    cubic: (x) => 1 - Math.pow(1 - x, 3),
    back: (x) => { const c = 1.6, c3 = c + 1; return 1 + c3 * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); },
    in: (x) => x * x * x,
  };
  const prog = (t, start, dur, e = ease.expo) => e(clamp((t - start) / dur));
  const milhar = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const mix = (a, b, p) => a.map((v, i) => Math.round(v + (b[i] - v) * p));

  function svg(name, cls) {
    const a = window.AGI_ASSETS[name];
    return `<svg class="${cls}" viewBox="${a.vb}" aria-hidden="true">${a.paths.map((d) => `<path d="${d}"/>`).join('')}</svg>`;
  }

  const MARKUP = `
    <div class="cue" id="c-gc">
      ${svg('formaParalelogramo', 'forma')}
      <div class="verde"></div>
      <div class="box">
        <span class="mask"><span class="l1">Matheus</span></span>
        <span class="mask"><span class="l2">Estagiário em Governança de TI</span></span>
      </div>
    </div>
    <div class="cue" id="c-prazo">
      ${svg('formaTriangulo', 'forma')}
      <div class="box">
        <span class="mask"><span class="topo">Programa de Estágio Agi</span></span>
        <span class="mask"><span class="destaque">Inscrições até <span class="hl">dia 08<i></i></span></span></span>
      </div>
    </div>
    <div class="cue" id="c-bolsa">
      <div class="box">
        <span class="mask"><span class="apoio">Bolsa-auxílio</span></span>
        <span class="mask"><span class="valor"><small>R$</small><span class="n">2.400</span></span></span>
      </div>
    </div>
    <div class="cue" id="c-vavr">
      <div class="box">
        <span class="mask"><span class="apoio">VA e VR</span></span>
        <span class="mask"><span class="valor"><small>+ de R$</small><span class="n">1.200</span></span></span>
      </div>
    </div>
    <div class="cue" id="c-tags">
      <div class="tag t1">Flexibilidade de jornada diária</div>
      <div class="tag t2">Mentoria próxima</div>
      <div class="tag t3"><span><b>IA</b> no seu dia a dia e do time</span></div>
    </div>
    <div class="cue" id="c-req">
      ${svg('formaLosango', 'forma')}
      <div class="box">
        <div class="barra"></div>
        <div>
          <span class="mask"><span class="principal">Graduação a partir</span></span>
          <span class="mask"><span class="principal">do 4º semestre</span></span>
          <span class="mask"><span class="sub">Ou outros cursos superiores</span></span>
        </div>
      </div>
    </div>
    <div class="cue" id="c-pres">
      ${svg('formaFaixa', 'forma')}
      <div class="box">
        <span class="mask"><span class="destaque"><span class="n">100</span>% Presencial</span></span>
        <div class="chip">Campinas</div>
      </div>
    </div>
    <div class="cue" id="c-final">
      <span class="linha"><span class="w">com</span> <span class="w verde">inteligência,</span></span>
      <span class="linha"><span class="w">com</span> <span class="w">a</span> <span class="w">gente!</span></span>
    </div>`;

  // Helpers de animação --------------------------------------------------
  const wipeX = (el, p) => { el.style.clipPath = `inset(-2px ${(1 - p) * 100}% -2px -2px round var(--raio))`; };
  const wipeY = (el, p) => { el.style.clipPath = `inset(${(1 - p) * 100}% -2px -2px -2px round var(--raio))`; };
  const rise = (el, p) => { el.style.transform = `translateY(${(1 - p) * 115}%)`; };
  const pop = (el, p, rot = 0) => {
    el.style.transform = `scale(${p}) rotate(${(1 - p) * rot}deg)`;
    el.style.opacity = clamp(p * 3);
  };
  // Saída: varredura para a esquerda + leve deslocamento.
  const exit = (el, o) => {
    el.style.clipPath = o > 0 ? `inset(-90px calc(-90px + ${o} * (100% + 180px)) -90px -90px)` : 'none';
    el.style.transform = `translateX(${-o * 36}px)`;
  };

  function mount(container) {
    const stage = document.createElement('div');
    stage.className = 'agi-stage';
    stage.innerHTML = MARKUP;
    container.appendChild(stage);
    const q = (s) => stage.querySelector(s);
    const qa = (s) => [...stage.querySelectorAll(s)];

    const ANIM = {
      gc(el, k) {
        wipeX(q('#c-gc .verde'), prog(k, 0, 0.5));
        wipeX(q('#c-gc .box'), prog(k, 0.08, 0.55));
        rise(q('#c-gc .l1'), prog(k, 0.22, 0.55));
        rise(q('#c-gc .l2'), prog(k, 0.32, 0.55));
        pop(q('#c-gc .forma'), prog(k, 0.36, 0.5, ease.back), -40);
      },
      prazo(el, k, c, t) {
        const box = q('#c-prazo .box');
        wipeY(box, prog(k, 0, 0.5));
        box.style.transform = `translateY(${(1 - prog(k, 0, 0.6)) * 40}px)`;
        rise(q('#c-prazo .topo'), prog(k, 0.15, 0.5));
        rise(q('#c-prazo .destaque'), prog(k, 0.25, 0.55));
        // “dia 08” acende no instante em que ele fala.
        const h = prog(t, c.marks.hl.t, 0.3, ease.cubic);
        const hb = prog(t, c.marks.hl.t, 0.45, ease.back);
        const hl = q('#c-prazo .hl');
        hl.style.color = `rgb(${mix([255, 255, 255], [255, 214, 0], h).join(',')})`;
        hl.style.transform = `scale(${1 + 0.14 * Math.sin(Math.PI * clamp((t - c.marks.hl.t) / 0.45))})`;
        q('#c-prazo .hl i').style.transform = `scaleX(${prog(t, c.marks.hl.t + 0.08, 0.4)})`;
        pop(q('#c-prazo .forma'), hb, 50);
      },
      bolsa(el, k) {
        wipeX(q('#c-bolsa .box'), prog(k, 0, 0.5));
        rise(q('#c-bolsa .apoio'), prog(k, 0.12, 0.5));
        rise(q('#c-bolsa .valor'), prog(k, 0.18, 0.5));
        q('#c-bolsa .n').textContent = milhar(Math.round(240 * prog(k, 0.18, 0.75, ease.cubic)) * 10);
      },
      vavr(el, k) {
        wipeX(q('#c-vavr .box'), prog(k, 0, 0.5));
        rise(q('#c-vavr .apoio'), prog(k, 0.12, 0.5));
        rise(q('#c-vavr .valor'), prog(k, 0.18, 0.5));
        q('#c-vavr .n').textContent = milhar(Math.round(120 * prog(k, 0.18, 0.75, ease.cubic)) * 10);
      },
      tags(el, k, c, t) {
        const starts = [c.in, c.marks.t2.t, c.marks.t3.t];
        qa('#c-tags .tag').forEach((tag, i) => {
          const kk = t - starts[i];
          tag.style.visibility = kk >= 0 ? 'visible' : 'hidden';
          wipeX(tag, prog(kk, 0, 0.45));
          tag.style.transform = `translateX(${(1 - prog(kk, 0, 0.6, ease.back)) * -60}px)`;
        });
      },
      req(el, k) {
        wipeX(q('#c-req .box'), prog(k, 0, 0.5));
        q('#c-req .barra').style.transform = `scaleY(${prog(k, 0.1, 0.5)})`;
        qa('#c-req .mask > span').forEach((s, i) => rise(s, prog(k, 0.22 + i * 0.09, 0.5)));
        pop(q('#c-req .forma'), prog(k, 0.4, 0.5, ease.back), 40);
      },
      pres(el, k) {
        wipeX(q('#c-pres .box'), prog(k, 0, 0.45));
        rise(q('#c-pres .destaque'), prog(k, 0.1, 0.5));
        q('#c-pres .n').textContent = Math.round(100 * prog(k, 0.1, 0.6, ease.cubic));
        const chip = q('#c-pres .chip');
        chip.style.transform = `scale(${prog(k, 0.35, 0.5, ease.back)})`;
        chip.style.opacity = clamp(prog(k, 0.35, 0.2));
        pop(q('#c-pres .forma'), prog(k, 0.45, 0.5, ease.back), -35);
      },
      final(el, k, c, t) {
        // Cada palavra entra no instante em que é falada; o layout já reserva o
        // espaço da frase inteira, então nada se reposiciona.
        const starts = [c.in, c.marks.w2.t, c.marks.w3.t, c.marks.w4.t, c.marks.w5.t];
        qa('#c-final .w').forEach((w, i) => {
          const kk = t - starts[i];
          const p = prog(kk, 0, 0.42, ease.back);
          w.style.opacity = clamp(kk / 0.12);
          w.style.transform = `translateY(${(1 - p) * 60}px) scale(${0.7 + 0.3 * p})`;
        });
      },
    };

    function render(t, cues) {
      for (const c of cues) {
        const el = q(`#c-${c.id}`);
        const on = t >= c.in && t < c.out;
        el.style.display = on ? 'block' : 'none';
        if (!on) continue;
        ANIM[c.id](el, t - c.in, c, t);
        const o = prog(t, c.out - OUT_DUR, OUT_DUR, ease.in);
        if (c.saida === 'fade') {
          el.style.opacity = 1 - o;
          el.style.transform = `translateY(${-o * 40}px)`;
        } else exit(el, o);
      }
    }

    return { stage, render };
  }

  // Aplica ajustes salvos ({id: {in, out, marks: {k: t}}}) sobre os padrões.
  function withOverrides(overrides) {
    const cues = JSON.parse(JSON.stringify(DEFAULT_CUES));
    for (const c of cues) {
      const o = overrides && overrides[c.id];
      if (!o) continue;
      if (typeof o.in === 'number') c.in = o.in;
      if (typeof o.out === 'number') c.out = o.out;
      for (const k of Object.keys(c.marks || {})) if (o.marks && typeof o.marks[k] === 'number') c.marks[k].t = o.marks[k];
    }
    return cues;
  }

  function toOverrides(cues) {
    const r = {};
    for (const c of cues) {
      r[c.id] = { in: +c.in.toFixed(2), out: +c.out.toFixed(2) };
      if (c.marks) r[c.id].marks = Object.fromEntries(Object.entries(c.marks).map(([k, m]) => [k, +m.t.toFixed(2)]));
    }
    return r;
  }

  window.AgiLetterings = { DEFAULT_CUES, mount, withOverrides, toOverrides };
})();
