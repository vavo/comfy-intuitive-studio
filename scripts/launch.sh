#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
RUNTIME="$ROOT/.runtime"
if [ -f "$RUNTIME/local.env" ]; then . "$RUNTIME/local.env"; fi
PYTHON=${STUDIO_PYTHON:-python3}
export PYTHONPATH="$RUNTIME/packages${PYTHONPATH:+:$PYTHONPATH}"
export PYTHONDONTWRITEBYTECODE=1
export STUDIO_BUDGET_CENTS=${STUDIO_BUDGET_CENTS:-300}
if [ ! -d "$RUNTIME/ComfyUI" ]; then echo 'Run scripts/setup.sh first.' >&2; exit 1; fi
if [ -z "${FORMA_API_KEY_FILE:-}" ]; then
  echo 'FORMA_API_KEY_FILE is unset. The no-cost probe works; inference needs a server-side key.' >&2
else
  export FORMA_API_KEY_FILE
  test -r "$FORMA_API_KEY_FILE"
fi
cd "$RUNTIME/ComfyUI"
exec "$PYTHON" main.py --cpu --listen 127.0.0.1 --port 8190 \
  --base-directory "$RUNTIME/data" --disable-auto-launch --disable-partner-nodes \
  --front-end-root "$RUNTIME/packages/comfyui_frontend_package/static"
