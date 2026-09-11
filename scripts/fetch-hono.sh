#!/usr/bin/env bash
# Downloads the Hono website docs (MIT licence), the second test corpus, pinned to one commit so line
# numbers never move. The files are committed; rerun only to change the pin.
set -euo pipefail
cd "$(dirname "$0")/.."
SHA=c48b858a67fb960f8cabe2ee9ac5e2cd0b8d66d9
OUT=test/fixtures/hono
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
curl -fsSL "https://codeload.github.com/honojs/website/tar.gz/$SHA" | tar -xz -C "$TMP"
SRC="$TMP/website-$SHA"
rm -rf "$OUT" && mkdir -p "$OUT"
(cd "$SRC/docs" && find . -name '*.md' -print0 | while IFS= read -r -d '' f; do mkdir -p "$OLDPWD/$OUT/$(dirname "$f")"; cp "$f" "$OLDPWD/$OUT/$f"; done)
cp "$SRC/LICENSE" "$OUT/LICENSE"
echo "Fetched $(find "$OUT" -name '*.md' | wc -l | tr -d ' ') files into $OUT/ at $SHA"
