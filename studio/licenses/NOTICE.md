# Código de terceiros

- `studio/helpers/{transcribe,transcribe_batch,pack_transcripts,timeline_view,grade,render}.py`
  derivam de browser-use/video-use (commit 43cfc566833548093455c9d4a46bd69913b7e552), licença MIT
  (`video-use-LICENSE`). Modificados: transcrição local com faster-whisper e idioma pt por padrão,
  zoom por trecho, fontes sem áudio, overlays com alfa, legendas ASS na identidade Agibank.
- HyperFrames (heygen-com/hyperframes, commit 6486d580218a57838b8bd37ab66e200c127acfe4), licença
  Apache-2.0 (`hyperframes-LICENSE`), é usado como ferramenta via `npx hyperframes@0.8.212`; os
  templates em `studio/motion/templates/` seguem o formato de composição dele.
- GSAP é instalado do npm (`studio/motion/package.json`) sob a licença padrão da GreenSock e não é versionado.
