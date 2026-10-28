# agibank-motion-hub
hub de motion do agi

## Motions

- **`charada-jeito-agi.html`** — Charada "O Jeito Agi" para o telão do Campus (1920x1080, 16:9, 24fps).
  Abra no navegador e use os controles (Play/Pause, cenas 01–06, barra de progresso, tela cheia).
  Atalhos: `Espaço` play/pause · `←`/`→` cena anterior/próxima · `1`–`6` ir para cena · `R` reiniciar · `F` tela cheia · `L` loop · `H` pausar antes de cada revelação.
  Parâmetros de URL: `?cena=3`, `?t=12.5`, `?autoplay=1`.
  Vídeo exportado: [`renders/charada-jeito-agi.mp4`](renders/charada-jeito-agi.mp4) (1920x1080, 24fps, H.264).
  Para gerar de novo após editar o HTML: `node tools/render-mp4.js` (requer Playwright com Chromium e ffmpeg).
