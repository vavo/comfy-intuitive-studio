#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
RUNTIME="$ROOT/.runtime"
PIN=b5a432157de6b8884f81104cd02926adf4d597e4
if [ -f "$RUNTIME/local.env" ]; then . "$RUNTIME/local.env"; fi
command -v git >/dev/null || { echo 'Install Git, then run ./start.sh again.' >&2; exit 1; }
command -v uv >/dev/null || { echo 'Install uv (macOS: brew install uv, Linux: https://docs.astral.sh/uv/getting-started/installation/), then run ./start.sh again.' >&2; exit 1; }

mkdir -p "$RUNTIME/data/custom_nodes"
BACKEND="$RUNTIME/ComfyUI"
if [ ! -d "$BACKEND" ]; then
  git init -q "$BACKEND"
  git -C "$BACKEND" remote add origin https://github.com/Comfy-Org/ComfyUI.git
fi
# A failed first download can be resumed without removing the runtime.
if ! git -C "$BACKEND" rev-parse --verify HEAD >/dev/null 2>&1; then
  git -C "$BACKEND" fetch --depth 1 origin "$PIN"
  git -C "$BACKEND" checkout --detach "$PIN"
fi
if [ "$(git -C "$BACKEND" rev-parse HEAD)" != "$PIN" ]; then
  echo 'Runtime differs from the tested ComfyUI pin. Use a separate checkout.' >&2
  exit 1
fi

if [ -n "${STUDIO_PYTHON:-}" ]; then
  mkdir -p "$RUNTIME/packages"
  uv pip install --python "$STUDIO_PYTHON" --target "$RUNTIME/packages" --no-deps -r "$ROOT/requirements-runtime.txt"
else
  PYTHON="$RUNTIME/venv/bin/python"
  if [ ! -x "$PYTHON" ]; then uv venv --python 3.12 "$RUNTIME/venv"; fi
  # macOS wheels already run on CPU. On Linux request the CPU PyTorch build.
  set --
  if [ "$(uname -s)" = Linux ]; then set -- --torch-backend cpu; fi
  uv pip install --python "$PYTHON" "$@" -r "$BACKEND/requirements.txt"
fi

LINK="$RUNTIME/data/custom_nodes/comfy-intuitive-studio"
if [ ! -e "$LINK" ] && [ ! -L "$LINK" ]; then ln -s "$ROOT" "$LINK"; fi
if [ "$(readlink "$LINK")" != "$ROOT" ]; then
  echo 'Existing extension link targets another checkout. Inspect it before proceeding.' >&2
  exit 1
fi
