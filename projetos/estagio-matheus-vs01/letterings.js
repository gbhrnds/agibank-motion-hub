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
    { id: 'ben', nome: '3 · Benefícios', fala: '“…bolsa-auxílio de 2 mil e 400 reais, VA e VR… flexibilidade… mentoria… IA…”', in: 94.54, out: 104.4,
      marks: {
        vavr: { nome: 'VA e VR + de R$ 1.200', t: 96.36 },
        t1: { nome: 'Flexibilidade de jornada', t: 98.46 },
        t2: { nome: 'Mentoria próxima', t: 100.52 },
        t3: { nome: 'IA no seu dia a dia', t: 101.82 },
      } },
    { id: 'req', nome: '4 · Requisito de curso', fala: '“…você precisa estar cursando Graduação a partir do 4º semestre…”', in: 105.08, out: 110.75 },
    { id: 'pres', nome: '5 · 100% Presencial', fala: '“…100% presencial em Campinas”', in: 110.94, out: 114.2 },
    { id: 'final', nome: '6 · Frase final', fala: '“…Com inteligência, com a gente.”', in: 119.06, out: 122.4, saida: 'fade',
      marks: {
        w2: { nome: 'Palavra “inteligência,”', t: 119.42 },
        w3: { nome: 'Palavra “com”', t: 120.3 },
        w4: { nome: 'Palavra “a”', t: 120.44 },
        w5: { nome: 'Palavra “gente.”', t: 120.56 },
      } },
  ];

  const OUT_DUR = 0.42;

  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const ease = {
    expo: (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
    cubic: (x) => 1 - Math.pow(1 - x, 3),
    inOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    back: (x) => { const c = 1.6, c3 = c + 1; return 1 + c3 * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); },
    in: (x) => x * x * x,
  };
  const prog = (t, start, dur, e = ease.expo) => e(clamp((t - start) / dur));
  const milhar = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const mix = (a, b, p) => a.map((v, i) => Math.round(v + (b[i] - v) * p));

  const caco = () => {
    const a = window.AGI_ASSETS.caco;
    return `<svg class="caco" viewBox="${a.vb}" aria-hidden="true"><path pathLength="1" d="${a.d}"/></svg>`;
  };
  const logo = () => {
    const a = window.AGI_ASSETS.logo;
    return `<svg class="logo" viewBox="${a.vb}" role="img" aria-label="Programa de estágio — 1ª turma de 2027 do Agibank">${a.inner}</svg>`;
  };

  const MARKUP = `
    <div class="cue" id="c-gc">
      ${caco()}
      <div class="sobreposto">
        <div class="fundo"></div>
        <div class="box azul">
          <span class="mask"><span class="l1">Matheus</span></span>
          <span class="mask"><span class="l2">Estagiário em Governança de TI</span></span>
        </div>
      </div>
    </div>
    <div class="cue" id="c-prazo">
      ${caco()}
      <div class="box azul">
        <span class="mask"><span>${logo()}</span></span>
        <span class="mask"><span class="chamada">Inscrições até o <span class="hl">dia 08<i></i></span></span></span>
      </div>
    </div>
    <div class="cue" id="c-ben">
      ${caco()}
      <div class="item"><div class="inner">
        <div class="box azul titulo">Bolsa-auxílio</div>
        <div class="box verde valor"><small>R$</small><span class="n">2.400</span></div>
      </div></div>
      <div class="item"><div class="inner">
        <div class="box azul titulo">VA e VR</div>
        <div class="box verde valor"><small>+ de R$</small><span class="n">1.200</span></div>
      </div></div>
      <div class="item"><div class="inner"><div class="box azul-medio tag">Flexibilidade de jornada diária</div></div></div>
      <div class="item"><div class="inner"><div class="box azul-medio tag">Mentoria próxima</div></div></div>
      <div class="item"><div class="inner"><div class="box azul-medio tag"><b>IA</b> no seu dia a dia e do time</div></div></div>
    </div>
    <div class="cue" id="c-req">
      ${caco()}
      <div class="sobreposto">
        <div class="fundo"></div>
        <div class="box azul">
          <span class="mask"><span class="principal">Graduação a partir</span></span>
          <span class="mask"><span class="principal">do 4º semestre</span></span>
          <span class="mask"><span class="sub">Ou outros cursos superiores</span></span>
        </div>
      </div>
    </div>
    <div class="cue" id="c-pres">
      ${caco()}
      <div class="box azul">
        <span class="mask"><span class="destaque"><span class="n">100</span>% Presencial</span></span>
        <div class="box verde chip">Campinas</div>
      </div>
    </div>
    <div class="cue" id="c-final">
      <span class="linha"><span class="w">Com</span> <span class="w destaque">inteligência,</span></span>
      <span class="linha"><span class="w">com</span> <span class="w">a</span> <span class="w destaque">gente.</span></span>
    </div>`;

  // Helpers de animação --------------------------------------------------
  const wipeX = (el, p) => { el.style.clipPath = `inset(-2px ${(1 - p) * 100}% -2px -2px round var(--raio))`; };
  const wipeY = (el, p) => { el.style.clipPath = `inset(${(1 - p) * 100}% -2px -2px -2px round var(--raio))`; };
  const rise = (el, p) => { el.style.transform = `translateY(${(1 - p) * 115}%)`; };
  // Caco: o traço se desenha e o neon acende junto.
  // Rotação leve: gira um pouco enquanto se desenha e segue girando devagar
  // (soma-se à rotação base de cada cue, definida no CSS).
  const desenha = (el, p, k) => {
    el.querySelector('path').style.strokeDasharray = `${p} 1`;
    el.style.opacity = clamp(p * 4);
    el.style.rotate = `${-18 * (1 - p) + 3.5 * k}deg`;
  };
  // Saída: varredura para a esquerda + leve deslocamento.
  const exit = (el, o) => {
    el.style.clipPath = o > 0 ? `inset(-400px calc(-400px + ${o} * (100% + 800px)) -400px -400px)` : 'none';
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
        wipeX(q('#c-gc .fundo'), prog(k, 0, 0.5));
        wipeX(q('#c-gc .box'), prog(k, 0.08, 0.55));
        rise(q('#c-gc .l1'), prog(k, 0.22, 0.55));
        rise(q('#c-gc .l2'), prog(k, 0.32, 0.55));
        desenha(q('#c-gc .caco'), prog(k, 0.3, 0.9, ease.inOut), k);
      },
      prazo(el, k, c, t) {
        const box = q('#c-prazo .box');
        wipeY(box, prog(k, 0, 0.5));
        box.style.transform = `translateY(${(1 - prog(k, 0, 0.6)) * 40}px)`;
        // “Inscrições até o dia 08” com exatamente a largura do logo do programa.
        const ch = q('#c-prazo .chamada');
        ch.style.fontSize = '100px';
        ch.style.fontSize = `${100 * q('#c-prazo .logo').clientWidth / ch.offsetWidth}px`;
        rise(q('#c-prazo .mask:first-child > span'), prog(k, 0.15, 0.55));
        rise(q('#c-prazo .chamada'), prog(k, 0.28, 0.55));
        // A máscara do “sobe” só serve na entrada; depois libera para o pulso de
        // escala do “dia 08” não ser cortado.
        q('#c-prazo .chamada').parentElement.style.overflow = k >= 0.83 ? 'visible' : 'hidden';
        desenha(q('#c-prazo .caco'), prog(k, 0.35, 0.9, ease.inOut), k);
        // “dia 08” acende em verde no instante em que ele fala.
        const m = c.marks.hl.t;
        const hl = q('#c-prazo .hl');
        hl.style.color = `rgb(${mix([255, 255, 255], [119, 223, 64], prog(t, m, 0.3, ease.cubic)).join(',')})`;
        hl.style.transform = `scale(${1 + 0.12 * Math.sin(Math.PI * clamp((t - m) / 0.45))})`;
        q('#c-prazo .hl i').style.transform = `scaleX(${prog(t, m + 0.08, 0.4)})`;
      },
      ben(el, k, c, t) {
        // Coluna ancorada embaixo: cada item cresce de 0 à altura natural e
        // empurra os anteriores para cima.
        const starts = [c.in, c.marks.vavr.t, c.marks.t1.t, c.marks.t2.t, c.marks.t3.t];
        const valores = [2400, 1200];
        qa('#c-ben .item').forEach((item, i) => {
          const kk = t - starts[i];
          const inner = item.firstElementChild;
          item.style.height = `${prog(kk, 0, 0.55, ease.inOut) * inner.offsetHeight}px`;
          item.style.visibility = kk >= 0 ? 'visible' : 'hidden';
          const boxes = inner.querySelectorAll('.box');
          boxes.forEach((b, j) => wipeX(b, prog(kk, 0.05 + j * 0.12, 0.5)));
          const n = inner.querySelector('.n');
          if (n) n.textContent = milhar(Math.round(valores[i] / 10 * prog(kk, 0.2, 0.75, ease.cubic)) * 10);
        });
        desenha(q('#c-ben .caco'), prog(k, 0.4, 1.0, ease.inOut), k);
      },
      req(el, k) {
        wipeX(q('#c-req .fundo'), prog(k, 0, 0.5));
        wipeX(q('#c-req .box'), prog(k, 0.08, 0.55));
        qa('#c-req .mask > span').forEach((s, i) => rise(s, prog(k, 0.22 + i * 0.09, 0.5)));
        desenha(q('#c-req .caco'), prog(k, 0.35, 0.9, ease.inOut), k);
      },
      pres(el, k) {
        wipeX(q('#c-pres > .box'), prog(k, 0, 0.45));
        rise(q('#c-pres .destaque'), prog(k, 0.1, 0.5));
        q('#c-pres .n').textContent = Math.round(100 * prog(k, 0.1, 0.6, ease.cubic));
        wipeX(q('#c-pres .chip'), prog(k, 0.35, 0.45));
        desenha(q('#c-pres .caco'), prog(k, 0.35, 0.9, ease.inOut), k);
      },
      final(el, k, c, t) {
        // Cada palavra entra no instante em que é falada; o layout já reserva o
        // espaço da frase inteira, então nada se reposiciona.
        const starts = [c.in, c.marks.w2.t, c.marks.w3.t, c.marks.w4.t, c.marks.w5.t];
        qa('#c-final .w').forEach((w, i) => {
          const kk = t - starts[i];
          const p = prog(kk, 0, 0.42, ease.back);
          w.style.opacity = clamp(kk / 0.12);
          w.style.transform = `translateY(${(1 - p) * 50}px) scale(${0.75 + 0.25 * p})`;
        });
      },
    };

    function render(t, cues) {
      for (const c of cues) {
        const el = q(`#c-${c.id}`);
        if (!el) continue;
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
