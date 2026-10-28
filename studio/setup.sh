#!/usr/bin/env bash
# Prepara o estúdio: dependências Python, GSAP local para os templates e checagens.
# Uso: bash studio/setup.sh
set -euo pipefail
cd "$(dirname "$0")"

ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$1"; }

echo "Estúdio Agibank — setup"

command -v ffmpeg >/dev/null && command -v ffprobe >/dev/null && ok "ffmpeg $(ffmpeg -version | head -1 | cut -d' ' -f3)" \
  || { warn "ffmpeg/ffprobe não encontrados (apt-get install -y ffmpeg / brew install ffmpeg)"; exit 1; }

NODE_MAJOR=$(node -v 2>/dev/null | sed 's/v\([0-9]*\).*/\1/' || echo 0)
[ "${NODE_MAJOR:-0}" -ge 22 ] && ok "node $(node -v)" || warn "HyperFrames precisa de Node.js 22+ (motion graphics indisponível)"

python3 -m pip install -q -r requirements.txt 2>&1 | grep -v -i "warning: running pip as" || true
python3 -c "import numpy, PIL, requests" && ok "dependências Python"
python3 -c "import faster_whisper" 2>/dev/null && ok "faster-whisper (transcrição local)" || warn "faster-whisper não instalado"

(cd motion && npm install --no-audit --no-fund --silent) && ok "GSAP local (studio/motion/node_modules)"
npx --yes hyperframes@0.8.212 --version >/dev/null 2>&1 && ok "HyperFrames CLI 0.8.212" || warn "HyperFrames CLI indisponível (npx hyperframes)"
npx --yes hyperframes@0.8.212 browser ensure >/dev/null 2>&1 && ok "Chrome para render" || warn "Chrome do HyperFrames não preparado (npx hyperframes browser ensure)"

if [ -n "${ELEVENLABS_API_KEY:-}" ] || grep -qs '^ELEVENLABS_API_KEY=..' .env ../.env; then
  ok "ELEVENLABS_API_KEY encontrada → transcrição com Scribe"
else
  warn "sem ELEVENLABS_API_KEY → transcrição local com Whisper (precisa de acesso a huggingface.co no 1º uso)"
fi
echo "Pronto. Coloque o vídeo bruto em projetos/<nome>/ e peça: \"edita esse vídeo\"."
