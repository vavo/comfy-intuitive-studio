#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
RUNTIME="$ROOT/.runtime"
PIN=b5a432157de6b8884f81104cd02926adf4d597e4
PYTHON=${STUDIO_PYTHON:-python3}
mkdir -p "$RUNTIME/data/custom_nodes" "$RUNTIME/packages"
if [ ! -d "$RUNTIME/ComfyUI" ]; then
  git init "$RUNTIME/ComfyUI"
  git -C "$RUNTIME/ComfyUI" remote add origin https://github.com/Comfy-Org/ComfyUI.git
  git -C "$RUNTIME/ComfyUI" fetch --depth 1 origin "$PIN"
  git -C "$RUNTIME/ComfyUI" checkout --detach FETCH_HEAD
fi
if [ "$(git -C "$RUNTIME/ComfyUI" rev-parse HEAD)" != "$PIN" ]; then
  echo 'Runtime differs from tested pin; use a separate checkout.' >&2
  exit 1
fi
uv pip install --python "$PYTHON" --target "$RUNTIME/packages" --no-deps -r "$ROOT/requirements-runtime.txt"
LINK="$RUNTIME/data/custom_nodes/comfy-intuitive-studio"
if [ ! -e "$LINK" ]; then ln -s "$ROOT" "$LINK"; fi
if [ "$(readlink "$LINK")" != "$ROOT" ]; then
  echo 'Existing extension link targets another checkout; inspect it before proceeding.' >&2
  exit 1
fi
echo 'Runtime ready. Set FORMA_API_KEY_FILE and run sh scripts/launch.sh.'
