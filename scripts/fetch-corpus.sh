#!/usr/bin/env bash
# Downloads the 30 Fastify doc files (MIT licence) used as the main test corpus, pinned to tag v5.6.0
# so line numbers never move. The files are committed; rerun only to change the pin.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=test/fixtures/fastify
BASE=https://raw.githubusercontent.com/fastify/fastify/v5.6.0
FILES=(
  Guides/Database.md
  Guides/Delay-Accepting-Requests.md
  Guides/Detecting-When-Clients-Abort.md
  Guides/Getting-Started.md
  Guides/Migration-Guide-V5.md
  Guides/Plugins-Guide.md
  Guides/Prototype-Poisoning.md
  Guides/Recommendations.md
  Guides/Serverless.md
  Guides/Testing.md
  Guides/Write-Plugin.md
  Reference/ContentTypeParser.md
  Reference/Decorators.md
  Reference/Encapsulation.md
  Reference/Errors.md
  Reference/HTTP2.md
  Reference/Hooks.md
  Reference/LTS.md
  Reference/Lifecycle.md
  Reference/Logging.md
  Reference/Middleware.md
  Reference/Plugins.md
  Reference/Principles.md
  Reference/Reply.md
  Reference/Request.md
  Reference/Routes.md
  Reference/Server.md
  Reference/TypeScript.md
  Reference/Validation-and-Serialization.md
  Reference/Warnings.md
)
for f in "${FILES[@]}"; do
  mkdir -p "$OUT/$(dirname "$f")"
  curl -fsSL "$BASE/docs/$f" -o "$OUT/$f"
done
curl -fsSL "$BASE/LICENSE" -o "$OUT/LICENSE"
echo "Fetched ${#FILES[@]} files into $OUT/"
