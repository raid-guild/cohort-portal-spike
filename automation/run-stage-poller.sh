#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# Ensure deps are present.
# Some environments set NODE_ENV=production or omit devDependencies; keep this deterministic.
if [ ! -d node_modules ]; then
  npm ci
fi

node automation/stage-poller.mjs
