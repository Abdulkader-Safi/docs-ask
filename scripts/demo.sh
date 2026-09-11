#!/bin/sh
# Builds the widget and an index over the Fastify fixtures, then serves examples/widget on :8000.
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root"
npm run -s build >/dev/null
node dist/cli-bin.mjs build --dir test/fixtures/fastify --target web --out examples/widget/docs-index.json
cp dist/docs-ask-widget.iife.js examples/widget/docs-ask-widget.iife.js
echo "serving examples/widget on http://localhost:${PORT:-8000} (ctrl-c to stop)"
cd examples/widget
exec python3 -m http.server "${PORT:-8000}" --bind 127.0.0.1
