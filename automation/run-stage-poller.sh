#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# Ensure deps are present (pg)
if [ ! -d node_modules ]; then
  npm ci
fi

node automation/stage-poller.mjs
