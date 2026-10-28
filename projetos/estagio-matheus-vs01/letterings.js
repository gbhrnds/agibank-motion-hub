// Motor de letterings VS01 — Programa de Estágio Agi (Matheus).
// Tudo é função pura do tempo do vídeo: render(t) desenha o quadro exato,
// então o player (tempo real) e o render.mjs (quadro a quadro) usam o mesmo código.
(function () {
  // Gatilhos extraídos da transcrição com timestamps por palavra (transcricao.json).
  // in = início da palavra-gatilho; marks = gatilhos internos; out = fim da animação de saída.
  const DEFAULT_CUES = [
    { id: 'gc', nome: '1 · Lower third Matheus', fala: '“Eu sou o Matheus, estagiário em governança de TI”', in: 74.72, out: 79.0 },
    { id: 'prazo', nome: '2 · Logo do programa + prazo', fala: '“…correr e se inscrever no Programa de Estágio do Agi. As inscrições vão até o dia 08…”', in: 87.96, out: 94.35,
      marks: {
        ch: { nome: '“Inscrições até o dia 08”', t: 90.34 },
        hl: { nome: 'Destaque “dia 08”', t: 91.2 },
      } },
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
    // Mola amortecida: passa ~15% do alvo, volta e assenta (bounce).
    bounce: (x) => (x >= 1 ? 1 : 1 - Math.exp(-6 * x) * Math.cos(3.2 * Math.PI * x)),
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
        <div class="cresce"><div class="inner"><span class="mask"><span class="chamada">Inscrições até o <span class="hl">dia 08<i></i></span></span></span></div></div>
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
  // Todos recebem (t, início, duração) para saber quando a entrada terminou:
  // a partir daí recortes (clip-path / máscaras) são liberados, assim nenhum
  // bounce ou pulso de escala posterior é cortado.
  const fim = (t, start, dur) => t >= start + dur;
  const wipeX = (el, t, start, dur) => {
    const p = prog(t, start, dur);
    el.style.clipPath = fim(t, start, dur) ? 'none' : `inset(-30px ${(1 - p) * 100}% -30px -30px round var(--raio))`;
  };
  const wipeY = (el, t, start, dur) => {
    const p = prog(t, start, dur);
    el.style.clipPath = fim(t, start, dur) ? 'none' : `inset(${(1 - p) * 100}% -30px -30px -30px round var(--raio))`;
  };
  // Texto sobe de dentro da máscara com bounce; a máscara tem folga para o
  // overshoot e é liberada ao fim da entrada.
  const rise = (el, t, start, dur = 0.7) => {
    el.style.transform = `translateY(${(1 - prog(t, start, dur, ease.bounce)) * 115}%)`;
    el.parentElement.style.overflow = fim(t, start, dur) ? 'visible' : 'hidden';
  };
  // Box entra com escala em mola a partir do canto indicado.
  const salta = (el, t, start, dur = 0.75, de = 0.82) => {
    const p = prog(t, start, dur, ease.bounce);
    el.style.scale = `${de + (1 - de) * p}`;
  };
  // Caco: o traço se desenha com o neon, entra com escala em mola e segue com
  // rotação leve (soma-se à rotação base de cada cue, definida no CSS).
  const desenha = (el, t, start, dur, k) => {
    const p = prog(t, start, dur, ease.inOut);
    el.querySelector('path').style.strokeDasharray = `${p} 1`;
    el.style.opacity = clamp(p * 4);
    el.style.scale = `${0.6 + 0.4 * prog(t, start, dur, ease.bounce)}`;
    el.style.rotate = `${-18 * (1 - p) + 3.5 * k}deg`;
  };
  // Saída: varredura para a esquerda + leve deslocamento.
  const exit = (el, o) => {
    el.style.clipPath = o > 0 ? `inset(-400px calc(-400px + ${o} * (100% + 800px)) -400px -400px)` : 'none';
    el.style.transform = `translateX(${-o * 36}px)`;
  };
  // Bloco que cresce de 0 à altura natural (com bounce) empurrando o que está acima.
  const cresce = (el, t, start, dur = 0.7) => {
    el.style.height = `${prog(t, start, dur, ease.bounce) * el.firstElementChild.offsetHeight}px`;
    el.style.overflow = fim(t, start, dur) ? 'visible' : 'hidden';
    el.style.visibility = t >= start ? 'visible' : 'hidden';
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
        const s = q('#c-gc .sobreposto');
        s.style.translate = `${(1 - prog(k, 0, 0.8, ease.bounce)) * -60}px 0`;
        wipeX(q('#c-gc .fundo'), k, 0, 0.5);
        wipeX(q('#c-gc .box'), k, 0.08, 0.55);
        salta(q('#c-gc .box'), k, 0.08);
        rise(q('#c-gc .l1'), k, 0.22);
        rise(q('#c-gc .l2'), k, 0.32);
        desenha(q('#c-gc .caco'), k, 0.3, 0.9, k);
      },
      prazo(el, k, c, t) {
        // 1º o logo do programa; depois, no gatilho “Inscrições”, a chamada
        // cresce embaixo dele e o box acompanha.
        const box = q('#c-prazo .box');
        wipeY(box, k, 0, 0.5);
        box.style.translate = `0 ${(1 - prog(k, 0, 0.8, ease.bounce)) * 50}px`;
        salta(box, k, 0);
        rise(q('#c-prazo .mask:first-child > span'), k, 0.15);
        desenha(q('#c-prazo .caco'), k, 0.35, 0.9, k);
        // “Inscrições até o dia 08” com exatamente a largura do logo do programa.
        const ch = q('#c-prazo .chamada');
        ch.style.fontSize = '100px';
        ch.style.fontSize = `${100 * q('#c-prazo .logo').clientWidth / ch.offsetWidth}px`;
        const tc = c.marks.ch.t;
        cresce(q('#c-prazo .cresce'), t, tc);
        rise(ch, t, tc + 0.08);
        // “dia 08” acende em verde no instante em que ele fala, com pulso em mola.
        const m = c.marks.hl.t;
        const hl = q('#c-prazo .hl');
        hl.style.color = `rgb(${mix([255, 255, 255], [119, 223, 64], prog(t, m, 0.3, ease.cubic)).join(',')})`;
        const x = Math.max(0, t - m);
        hl.style.scale = `${1 + 0.16 * Math.exp(-5 * x) * Math.sin(Math.PI * 2.4 * Math.min(x, 1.2))}`;
        q('#c-prazo .hl i').style.transform = `scaleX(${prog(t, m + 0.08, 0.6, ease.bounce)})`;
      },
      ben(el, k, c, t) {
        // Coluna ancorada embaixo: cada item cresce de 0 à altura natural (com
        // bounce) e empurra os anteriores para cima.
        const starts = [c.in, c.marks.vavr.t, c.marks.t1.t, c.marks.t2.t, c.marks.t3.t];
        const valores = [2400, 1200];
        qa('#c-ben .item').forEach((item, i) => {
          const s = starts[i];
          cresce(item, t, s);
          item.querySelectorAll('.box').forEach((b, j) => {
            wipeX(b, t, s + 0.05 + j * 0.12, 0.5);
            salta(b, t, s + 0.05 + j * 0.12);
          });
          const n = item.querySelector('.n');
          if (n) n.textContent = milhar(Math.round(valores[i] / 10 * prog(t, s + 0.2, 0.75, ease.cubic)) * 10);
        });
        desenha(q('#c-ben .caco'), k, 0.4, 1.0, k);
      },
      req(el, k) {
        const s = q('#c-req .sobreposto');
        s.style.translate = `${(1 - prog(k, 0, 0.8, ease.bounce)) * -60}px 0`;
        wipeX(q('#c-req .fundo'), k, 0, 0.5);
        wipeX(q('#c-req .box'), k, 0.08, 0.55);
        salta(q('#c-req .box'), k, 0.08);
        qa('#c-req .mask > span').forEach((sp, i) => rise(sp, k, 0.22 + i * 0.09));
        desenha(q('#c-req .caco'), k, 0.35, 0.9, k);
      },
      pres(el, k) {
        const box = q('#c-pres > .box');
        wipeX(box, k, 0, 0.45);
        salta(box, k, 0);
        rise(q('#c-pres .destaque'), k, 0.1);
        q('#c-pres .n').textContent = Math.round(100 * prog(k, 0.1, 0.6, ease.cubic));
        const chip = q('#c-pres .chip');
        chip.style.scale = `${prog(k, 0.35, 0.75, ease.bounce)}`;
        chip.style.opacity = clamp((k - 0.35) / 0.12);
        desenha(q('#c-pres .caco'), k, 0.35, 0.9, k);
      },
      final(el, k, c, t) {
        // Cada palavra entra no instante em que é falada, com bounce; o layout
        // já reserva o espaço da frase inteira, então nada se reposiciona.
        const starts = [c.in, c.marks.w2.t, c.marks.w3.t, c.marks.w4.t, c.marks.w5.t];
        qa('#c-final .w').forEach((w, i) => {
          const kk = t - starts[i];
          const p = prog(kk, 0, 0.7, ease.bounce);
          w.style.opacity = clamp(kk / 0.12);
          w.style.transform = `translateY(${(1 - p) * 50}px) scale(${0.7 + 0.3 * p})`;
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
