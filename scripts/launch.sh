#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
RUNTIME="$ROOT/.runtime"
if [ -f "$RUNTIME/local.env" ]; then . "$RUNTIME/local.env"; fi
PYTHON=${STUDIO_PYTHON:-"$RUNTIME/venv/bin/python"}
if [ ! -d "$RUNTIME/ComfyUI" ] || ! command -v "$PYTHON" >/dev/null; then
  echo 'Run ./start.sh to install and start Studio.' >&2
  exit 1
fi
set --
if [ -n "${STUDIO_PYTHON:-}" ]; then
  export PYTHONPATH="$RUNTIME/packages${PYTHONPATH:+:$PYTHONPATH}"
  set -- --front-end-root "$RUNTIME/packages/comfyui_frontend_package/static"
fi
export PYTHONDONTWRITEBYTECODE=1
export STUDIO_BUDGET_CENTS=${STUDIO_BUDGET_CENTS:-300}
if [ -n "${FORMA_API_KEY_FILE:-}" ]; then export FORMA_API_KEY_FILE; fi
PORT=${STUDIO_PORT:-8190}
echo "New Studio session: http://127.0.0.1:$PORT/?template=text-to-image.app&source=comfy-intuitive-studio&mode=linear"
echo "Resume ComfyUI: http://127.0.0.1:$PORT/"
cd "$RUNTIME/ComfyUI"
exec "$PYTHON" main.py --cpu --listen 127.0.0.1 --port "$PORT" \
  --base-directory "$RUNTIME/data" --disable-auto-launch --disable-partner-nodes "$@"
