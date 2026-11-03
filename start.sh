#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
sh "$ROOT/scripts/setup.sh"
exec sh "$ROOT/scripts/launch.sh"
